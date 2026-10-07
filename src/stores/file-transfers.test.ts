import { expect, it } from 'vitest'
import { connect, deferred, native } from './files.fixture'
import { useFiles } from './files'

async function preparing() {
  await connect()
  const job = useFiles().prepareTransfer('tab', 'session', '/', 10)!
  native.stageBegin.mockResolvedValueOnce('staging')
  return job
}

it('shows a drop being prepared and counts it as an active transfer', async () => {
  const files = useFiles()
  const job = await preparing()
  expect(job.stage('staging')).toBe(true)
  job.progress(4)
  expect(files.state('tab').transfers[0]).toMatchObject({ state: 'preparing', bytes: 4, total: 10 })
  expect(files.hasTransfers('tab')).toBe(true)
})

it('cancelling a preparation stops it and discards its staging', async () => {
  const files = useFiles()
  const job = await preparing()
  job.stage('staging')
  await files.cancelTransfer('session', job.id)
  expect(job.active()).toBe(false)
  expect(native.stageDiscard).toHaveBeenCalledWith('staging')
  expect(files.state('tab').transfers[0].state).toBe('cancelled')
  expect(native.request).toHaveBeenCalledTimes(1)
})

it('a preparation finished after its owner closed neither starts nor recreates the explorer', async () => {
  const files = useFiles()
  const job = await preparing()
  job.stage('staging')
  const finishing = deferred<string[]>()
  const starting = finishing.promise.then((sources) => job.start(sources))
  files.release('tab')
  finishing.resolve(['/staged/file'])
  await starting
  expect(files.panels.tab).toBeUndefined()
  expect(native.stageDiscard).toHaveBeenCalledWith('staging')
  expect(native.request).toHaveBeenCalledTimes(1)
})

it('staging begun after cancellation is discarded immediately', async () => {
  const files = useFiles()
  const job = await preparing()
  await files.cancelTransfer('session', job.id)
  expect(job.stage('late-staging')).toBe(false)
  expect(native.stageDiscard).toHaveBeenCalledWith('late-staging')
})

it('a finished preparation becomes the upload with the same identity', async () => {
  const files = useFiles()
  const job = await preparing()
  job.stage('staging')
  native.request.mockResolvedValueOnce(null)
  await job.start(['/staged/file'])
  expect(native.request).toHaveBeenLastCalledWith(
    'session',
    expect.objectContaining({
      operation: 'transfer',
      id: job.id,
      owner: 'server-a',
      sources: ['/staged/file'],
    }),
  )
  expect(files.state('tab').transfers).toMatchObject([{ id: job.id, direction: 'upload' }])
  expect(native.stageDiscard).not.toHaveBeenCalled()
})
