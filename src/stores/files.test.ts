import { expect, it } from 'vitest'
import { connect, deferred, draft, native, remoteText } from './files.fixture'
import { useFiles } from './files'

it('keeps edits made during saving dirty and retains them after a failed save', async () => {
  const files = useFiles()
  const document = await draft('tab', 'first edit')
  const saving = deferred()
  native.request.mockReturnValueOnce(saving.promise)
  const saved = files.saveDocument('tab', 'session', document.id)
  document.content = 'newer edit'
  saving.resolve(remoteText('first edit'))
  await saved
  expect(document.original).toBe('first edit')
  expect(document.content).toBe('newer edit')
  native.request.mockRejectedValueOnce({ code: 'file_io', message: 'interruption' })
  expect(await files.saveDocument('tab', 'replacement-session', document.id)).toBe(false)
  expect(document.content).toBe('newer edit')
  expect(document.original).toBe('first edit')
})

it('does not discard edits typed while a reload is waiting for the server', async () => {
  const files = useFiles()
  const document = await draft('tab', 'old')
  const reading = deferred()
  native.request.mockReturnValueOnce(reading.promise)
  const reloading = files.reloadDocument('tab', 'session', document.id)
  document.content = 'typed while waiting'
  reading.resolve(remoteText('remote'))
  await reloading
  expect(document.content).toBe('typed while waiting')
  expect(document.original).toBe('old')
})

it('refuses saving or reloading a retained draft on another server or account', async () => {
  const files = useFiles()
  const document = await draft('tab', 'draft from a')
  files.disconnect('tab')
  await connect('tab', 'session-b', 'server-b')
  const count = native.request.mock.calls.length
  expect(files.ownsDocument('tab', document)).toBe(false)
  expect(await files.saveDocument('tab', 'session-b', document.id)).toBe(false)
  await files.reloadDocument('tab', 'session-b', document.id)
  expect(native.request.mock.calls.length).toBe(count)
  expect(document.content).toBe('draft from a')
})

it('does not resurrect the explorer when transfer startup fails after owner closure', async () => {
  const files = useFiles()
  await connect()
  const starting = deferred()
  native.request.mockReturnValueOnce(starting.promise)
  const sending = files.startTransfer('tab', 'session', {
    direction: 'upload',
    sources: ['/local/config'],
    destination: '/',
  })
  expect(files.hasTransfers('tab')).toBe(true)
  files.release('tab')
  starting.reject({ code: 'session_closed', message: 'closed' })
  await sending
  expect(files.panels.tab).toBeUndefined()
})

it('retries a transfer interrupted by disconnection with its original owner and progress', async () => {
  const files = useFiles()
  await connect()
  native.request.mockResolvedValueOnce(null)
  await files.startTransfer('tab', 'session', {
    direction: 'upload',
    sources: ['/local/a', '/local/b'],
    destination: '/',
  })
  const [shown] = files.state('tab').transfers
  files.transferEvent('tab', {
    ...shown,
    state: 'running',
    completedSources: ['/local/a'],
    directories: {},
  })
  files.disconnect('tab')
  expect(shown).toMatchObject({ state: 'failed', retryable: true })
  // A late native cancellation must not drop the retry kept for the disconnected tab.
  files.transferEvent('tab', {
    ...shown,
    state: 'cancelled',
    message: 'Fichier temporaire restant possible : /remote/.partial',
    completedSources: ['/local/a'],
    directories: {},
  })
  expect(shown).toMatchObject({ state: 'failed', retryable: true })
  expect(shown.message).toContain('/remote/.partial')
  await connect('tab', 'session-2')
  native.request.mockResolvedValueOnce(null)
  await files.retryTransfer('tab', 'session-2', shown.id)
  expect(native.request).toHaveBeenLastCalledWith(
    'session-2',
    expect.objectContaining({
      operation: 'transfer',
      owner: 'server-a',
      completedSources: ['/local/a'],
    }),
  )
})
