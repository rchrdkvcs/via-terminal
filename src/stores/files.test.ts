import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFiles } from './files'
import { transferPlans, useFileTransfers } from '@/components/files/useFileTransfers'

const native = vi.hoisted(() => ({ request: vi.fn(), pick: vi.fn(), stageDiscard: vi.fn() }))
vi.mock('@/ipc/files', () => ({ filesApi: native }))
vi.mock('@/ipc/events', () => ({ on: () => () => {} }))
beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

it('keeps edits made during saving dirty and retains them after a failed save', async () => {
  const files = useFiles()
  native.request.mockResolvedValueOnce({
    path: '/config',
    resolvedPath: '/config',
    content: 'old',
    permissions: 420,
    uid: 1,
    gid: 1,
  })
  await files.openDocument('tab', 'session', '/config')
  const document = files.state('tab').documents[0]
  document.content = 'first edit'
  let complete!: (value: unknown) => void
  native.request.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  const saving = files.saveDocument('tab', 'session', document.id)
  document.content = 'newer edit'
  complete({
    path: '/config',
    resolvedPath: '/config',
    content: 'first edit',
    permissions: 420,
    uid: 1,
    gid: 1,
  })
  await saving
  expect(document.original).toBe('first edit')
  expect(document.content).toBe('newer edit')
  native.request.mockRejectedValueOnce({ code: 'file_io', message: 'interruption' })
  expect(await files.saveDocument('tab', 'replacement-session', document.id)).toBe(false)
  expect(document.content).toBe('newer edit')
  expect(document.original).toBe('first edit')
})

it('does not discard edits typed while a reload is waiting for the server', async () => {
  const files = useFiles()
  native.request.mockResolvedValueOnce({ path: '/config', resolvedPath: '/config', content: 'old' })
  await files.openDocument('tab', 'session', '/config')
  const document = files.state('tab').documents[0]
  let complete!: (value: unknown) => void
  native.request.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  const reloading = files.reloadDocument('tab', 'session', document.id)
  document.content = 'typed while waiting'
  complete({ path: '/config', resolvedPath: '/config', content: 'remote' })
  await reloading
  expect(document.content).toBe('typed while waiting')
  expect(document.original).toBe('old')
})

it('refuses saving or reloading a retained draft on another server or account', async () => {
  const files = useFiles()
  native.request.mockResolvedValueOnce({
    owner: 'server-a',
    path: '/config',
    resolvedPath: '/config',
    content: 'old',
  })
  await files.openDocument('tab', 'session-a', '/config')
  const document = files.state('tab').documents[0]
  document.content = 'draft from a'
  files.disconnect('tab')
  native.request.mockResolvedValueOnce({ owner: 'server-b', path: '/', entries: [] })
  await files.navigate('tab', 'session-b', '/')
  const count = native.request.mock.calls.length
  expect(await files.saveDocument('tab', 'session-b', document.id)).toBe(false)
  await files.reloadDocument('tab', 'session-b', document.id)
  expect(native.request.mock.calls.length).toBe(count)
  expect(document.content).toBe('draft from a')
})

it('does not resurrect the explorer when transfer startup fails after owner closure', async () => {
  const files = useFiles()
  transferPlans.clear()
  files.state('tab').directory = '/'
  const transfers = useFileTransfers({ tabId: () => 'tab', sessionId: () => 'session' })
  native.pick.mockResolvedValueOnce(['/local/config'])
  let reject!: (cause: unknown) => void
  native.request.mockReturnValueOnce(
    new Promise((_, failure) => {
      reject = failure
    }),
  )
  const sending = transfers.upload(false)
  await Promise.resolve()
  expect(transferPlans.size).toBe(1)
  files.release('tab')
  reject({ code: 'session_closed', message: 'closed' })
  await sending
  expect(files.panels.tab).toBeUndefined()
  expect(transferPlans.size).toBe(0)
})

it('ignores a local picker failure after its owner has closed', async () => {
  const files = useFiles()
  files.state('tab')
  const transfers = useFileTransfers({ tabId: () => 'tab', sessionId: () => 'session' })
  let reject!: (cause: unknown) => void
  native.pick.mockReturnValueOnce(
    new Promise((_, failure) => {
      reject = failure
    }),
  )
  const picking = transfers.upload(false)
  files.release('tab')
  reject({ message: 'picker closed' })
  await picking
  expect(files.panels.tab).toBeUndefined()
})
