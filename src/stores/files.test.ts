import { describe, expect, it } from 'vitest'
import {
  connect,
  deferred,
  draft,
  end,
  native,
  ready,
  reconnect,
  remoteText,
} from './files.fixture'
import { useFiles } from './files'

it('keeps edits made during saving dirty and retains them after a failed save', async () => {
  const files = useFiles()
  const document = await draft('tab', 'first edit')
  const saving = deferred()
  native.request.mockReturnValueOnce(saving.promise)
  const saved = files.saveDocument('tab')
  document.content = 'newer edit'
  saving.resolve(remoteText('first edit'))
  await saved
  expect(document.original).toBe('first edit')
  expect(document.content).toBe('newer edit')
  native.request.mockRejectedValueOnce({ code: 'file_io', message: 'interruption' })
  expect(await files.saveDocument('tab')).toBe(false)
  expect(document.content).toBe('newer edit')
  expect(document.original).toBe('first edit')
})

it('does not discard edits typed while a reload is waiting for the server', async () => {
  const files = useFiles()
  const document = await draft('tab', 'old')
  const reading = deferred()
  native.request.mockReturnValueOnce(reading.promise)
  const reloading = files.reloadDocument('tab')
  document.content = 'typed while waiting'
  reading.resolve(remoteText('remote'))
  await reloading
  expect(document.content).toBe('typed while waiting')
  expect(document.original).toBe('old')
})

it('a document reconnected to another server or account keeps its draft and cannot be saved', async () => {
  const files = useFiles()
  const document = await draft('tab', 'draft from a')
  end()
  await reconnect('tab', 'session-b', 'server-b', 'remote of b')
  expect(files.ownership('tab')).toBe('other')
  const count = native.request.mock.calls.length
  expect(await files.saveDocument('tab')).toBe(false)
  await files.reloadDocument('tab')
  expect(native.request.mock.calls.length).toBe(count)
  expect(document).toMatchObject({ content: 'draft from a', original: 'old' })
  expect(document.error).toContain('Le serveur ou le compte a changé')
})

it('a document reconnected to its own server keeps its draft and saves again', async () => {
  const files = useFiles()
  const document = await draft()
  end()
  expect(files.ownership('tab')).toBe('unknown')
  await reconnect()
  expect(files.ownership('tab')).toBe('same')
  expect(document).toMatchObject({ content: 'draft', original: 'old', error: null })
  native.request.mockResolvedValueOnce(remoteText('draft'))
  expect(await files.saveDocument('tab')).toBe(true)
  expect(native.request).toHaveBeenLastCalledWith(
    'session-2',
    expect.objectContaining({ operation: 'save', original: 'old' }),
  )
})

it('a draft whose file changed remotely while disconnected asks to reload or overwrite', async () => {
  const files = useFiles()
  const document = await draft()
  end()
  await reconnect('tab', 'session-2', 'server-a', 'changed elsewhere')
  expect(files.ownership('tab')).toBe('same')
  expect(document).toMatchObject({ content: 'draft', original: 'old', conflict: true })
})

it('asks to reconnect before saving while disconnected', async () => {
  const files = useFiles()
  const document = await draft()
  end()
  const count = native.request.mock.calls.length
  expect(await files.saveDocument('tab')).toBe(false)
  expect(native.request.mock.calls.length).toBe(count)
  expect(document.error).toContain('Reconnectez')
})

it('a save answered after reconnection keeps the draft and asks to verify the remote file', async () => {
  const files = useFiles()
  const document = await draft()
  const saving = deferred()
  native.request.mockReturnValueOnce(saving.promise)
  const saved = files.saveDocument('tab')
  ready('tab', 'session-2')
  saving.resolve(remoteText('draft'))
  expect(await saved).toBe(false)
  expect(document).toMatchObject({ content: 'draft', original: 'old', saving: false })
  expect(document.error).toContain('vérifiez le fichier distant')
})

it('does not keep a document read by a session that disconnected during reading', async () => {
  const files = useFiles()
  ready()
  const reading = deferred()
  native.request.mockReturnValueOnce(reading.promise)
  const opening = files.openDocument('tab', '/config')
  end()
  reading.resolve(remoteText())
  await opening
  expect(files.document('tab')).toBeUndefined()
})

describe.each([
  ['reconnection', () => ready('tab', 'session-2')],
  ['release', () => useFiles().release('tab')],
])('after %s', (event, interrupt) => {
  it.each(['resolves', 'rejects'])('a late explorer reply that %s is dropped', async (outcome) => {
    const files = useFiles()
    await connect()
    const replies = [deferred(), deferred()]
    replies.forEach((reply) => native.request.mockReturnValueOnce(reply.promise))
    const pending = [
      files.navigate('tab', '/late'),
      files.startTransfer('tab', { direction: 'upload', sources: ['/a'], destination: '/' }),
    ]
    const [shown] = files.state('tab').transfers
    interrupt()
    if (outcome === 'resolves') {
      replies[0].resolve({ owner: 'server-a', path: '/late', entries: [{ name: 'stale' }] })
      replies[1].resolve(null)
    } else replies.forEach((reply) => reply.reject({ code: 'file_io', message: 'late' }))
    await Promise.all(pending)
    if (event === 'release') return expect(files.panels.tab).toBeUndefined()
    expect(files.state('tab')).toMatchObject({ directory: '/', entries: [], busy: false })
    expect(files.state('tab').error).toBeNull()
    expect(shown).toMatchObject({ state: 'failed', retryable: true })
    expect(shown.message).toContain('Connexion interrompue')
  })

  it.each(['resolves', 'rejects'])('a late document reply that %s is dropped', async (outcome) => {
    const files = useFiles()
    const document = await draft()
    const reading = deferred()
    native.request.mockReturnValueOnce(reading.promise)
    const reloading = files.reloadDocument('tab')
    interrupt()
    if (outcome === 'resolves') reading.resolve(remoteText('remote'))
    else reading.reject({ code: 'file_io', message: 'late' })
    await reloading
    expect(document).toMatchObject({ content: 'draft', original: 'old', error: null })
    expect(files.document('tab')).toBe(event === 'release' ? undefined : document)
  })
})

it('reading a released explorer does not recreate it', async () => {
  const files = useFiles()
  await draft()
  files.release('tab')
  expect(files.state('tab')).toMatchObject({ visible: false, directory: '.' })
  expect(files.document('tab')).toBeUndefined()
  expect(files.panels.tab).toBeUndefined()
})

it('does not resurrect the explorer when transfer startup fails after owner closure', async () => {
  const files = useFiles()
  await connect()
  const starting = deferred()
  native.request.mockReturnValueOnce(starting.promise)
  const sending = files.startTransfer('tab', {
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
  await files.startTransfer('tab', {
    direction: 'upload',
    sources: ['/local/a', '/local/b'],
    destination: '/',
  })
  const [shown] = files.state('tab').transfers
  files.transferEvent({
    ...shown,
    state: 'running',
    completedSources: ['/local/a'],
    directories: {},
  })
  end()
  expect(shown).toMatchObject({ state: 'failed', retryable: true })
  // A late native cancellation must not drop the retry kept for the disconnected tab.
  files.transferEvent({
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
  await files.retryTransfer('tab', shown.id)
  expect(native.request).toHaveBeenLastCalledWith(
    'session-2',
    expect.objectContaining({
      operation: 'transfer',
      owner: 'server-a',
      completedSources: ['/local/a'],
    }),
  )
})
