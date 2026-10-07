import { expect, it } from 'vitest'
import { connect, deferred, end, native } from './files.fixture'
import { useFiles, type DroppedFile } from './files'

/** Local staging kept in memory: every staged path with its bytes, `null` for directories. */
function staging() {
  const disk = new Map<string, number[] | null>()
  native.stageBegin.mockResolvedValue('staging')
  native.stageDirectory.mockImplementation(async (_id: string, path: string) => {
    disk.set(path, null)
  })
  native.stageChunk.mockImplementation(async (_id: string, path: string, data: Uint8Array) => {
    disk.set(path, [...(disk.get(path) ?? []), ...data])
  })
  native.stageFinish.mockImplementation(async () =>
    [...new Set([...disk.keys()].map((path) => `/staged/${path.split('/')[0]}`))].sort(),
  )
  return disk
}
const file = (bytes: number): Blob => new Blob([new Uint8Array(bytes).fill(7)])
const drop: DroppedFile[] = [
  { path: 'dir', file: null },
  { path: 'dir/large', file: file(300 * 1024) },
  { path: 'empty', file: file(0) },
]
/** Starts dropping on `/`; staging pauses at the first chunk until `chunk.resolve()`. */
async function dropping() {
  const files = useFiles()
  await connect()
  const disk = staging()
  const chunk = deferred<void>()
  const write = native.stageChunk.getMockImplementation()!
  native.stageChunk.mockImplementationOnce(async (...args: [string, string, Uint8Array]) => {
    await chunk.promise
    return write(...args)
  })
  const done = files.uploadDropped('tab', '/', drop)
  await new Promise((resolve) => setTimeout(resolve))
  const [shown] = files.transfers('tab')
  return { files, disk, chunk, done, shown }
}
const uploads = () =>
  native.request.mock.calls.filter(([, request]) => request.operation === 'transfer')

it('stages dropped files and directories, then uploads them as the same transfer', async () => {
  const { files, disk, chunk, done, shown } = await dropping()
  expect(shown).toMatchObject({ state: 'preparing', path: '/', bytes: 0, total: 300 * 1024 })
  expect(files.hasTransfers('tab')).toBe(true)
  native.request.mockResolvedValueOnce(null)
  chunk.resolve()
  await done
  expect(disk.get('dir')).toBeNull()
  expect(disk.get('dir/large')).toEqual(new Array(300 * 1024).fill(7))
  expect(disk.get('empty')).toEqual([])
  expect(native.stageChunk.mock.calls.map(([, path, data]) => [path, data.length])).toEqual([
    ['dir/large', 256 * 1024],
    ['dir/large', 44 * 1024],
    ['empty', 0],
  ])
  expect(uploads()).toEqual([
    [
      'session',
      expect.objectContaining({
        id: shown.id,
        owner: 'server-a',
        direction: 'upload',
        sources: ['/staged/dir', '/staged/empty'],
        destination: '/',
      }),
    ],
  ])
  expect(files.transfers('tab')).toEqual([
    expect.objectContaining({ id: shown.id, state: 'running', bytes: 300 * 1024 }),
  ])
  expect(native.stageDiscard).not.toHaveBeenCalled()
})

it('cancelling a drop mid-way stops staging and discards it', async () => {
  const { files, chunk, done, shown } = await dropping()
  await files.cancelTransfer(shown.id)
  chunk.resolve()
  await done
  expect(shown).toMatchObject({ state: 'cancelled', retryable: false })
  expect(native.stageChunk).toHaveBeenCalledTimes(1)
  expect(native.stageDiscard).toHaveBeenCalledWith('staging')
  expect(uploads()).toEqual([])
  expect(files.hasTransfers('tab')).toBe(false)
})

it('a disconnection during staging interrupts the drop and discards it', async () => {
  const { chunk, done, shown } = await dropping()
  end()
  chunk.resolve()
  await done
  expect(shown).toMatchObject({ state: 'failed', retryable: false })
  expect(shown.message).toContain('Connexion interrompue')
  expect(native.stageDiscard).toHaveBeenCalledWith('staging')
  expect(uploads()).toEqual([])
})

it('a drop whose explorer closed neither uploads nor recreates the explorer', async () => {
  const { files, chunk, done } = await dropping()
  files.release('tab')
  chunk.resolve()
  await done
  expect(files.panels.tab).toBeUndefined()
  expect(native.stageDiscard).toHaveBeenCalledWith('staging')
  expect(uploads()).toEqual([])
})

it('staging begun after cancellation is discarded at once', async () => {
  const files = useFiles()
  await connect()
  staging()
  const begun = deferred<string>()
  native.stageBegin.mockReturnValueOnce(begun.promise)
  const done = files.uploadDropped('tab', '/', drop)
  await files.cancelTransfer(files.transfers('tab')[0].id)
  begun.resolve('late-staging')
  await done
  expect(native.stageDiscard).toHaveBeenCalledWith('late-staging')
  expect(native.stageChunk).not.toHaveBeenCalled()
})

it('a staging failure fails the drop and discards what was staged', async () => {
  const { chunk, done, shown } = await dropping()
  native.stageChunk.mockRejectedValueOnce({ code: 'file_local', message: 'Disque plein' })
  chunk.resolve()
  await done
  expect(shown).toMatchObject({ state: 'failed', message: 'Disque plein.', retryable: false })
  expect(native.stageDiscard).toHaveBeenCalledWith('staging')
})

it('an upload interrupted after staging retries from its staged copy, then discards it', async () => {
  const { files, chunk, done, shown } = await dropping()
  native.request.mockResolvedValueOnce(null)
  chunk.resolve()
  await done
  end()
  expect(shown).toMatchObject({ state: 'failed', retryable: true })
  expect(native.stageDiscard).not.toHaveBeenCalled()
  await connect('tab', 'session-2')
  native.request.mockResolvedValueOnce(null)
  await files.retryTransfer('tab', shown.id)
  const [retried] = files.transfers('tab')
  expect(retried.id).not.toBe(shown.id)
  expect(uploads().at(-1)).toEqual([
    'session-2',
    expect.objectContaining({ id: retried.id, sources: ['/staged/dir', '/staged/empty'] }),
  ])
  files.transferEvent({
    ...retried,
    state: 'completed',
    completedSources: ['/staged/dir', '/staged/empty'],
    directories: {},
  })
  expect(native.stageDiscard).toHaveBeenCalledWith('staging')
  files.clearFinishedTransfers('tab')
  expect(files.transfers('tab')).toEqual([])
})
