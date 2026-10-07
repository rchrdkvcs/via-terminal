import { beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RemoteText } from '@/ipc/files'
import { useFiles } from './files'

const native = vi.hoisted(() => ({
  request: vi.fn(),
  pick: vi.fn(),
  stageBegin: vi.fn(),
  stageDirectory: vi.fn(),
  stageChunk: vi.fn(),
  stageFinish: vi.fn(),
  stageDiscard: vi.fn(),
}))
export { native }
vi.mock('@/ipc/files', () => ({ filesApi: native }))

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
export const remoteText = (content = 'old', owner = 'server-a'): RemoteText => ({
  owner,
  path: '/config',
  resolvedPath: '/config',
  content,
  permissions: 0o644,
  uid: 1,
  gid: 1,
})
/** Lists `/` as `owner` through `sessionId`, so the explorer is connected and owned. */
export async function connect(tabId = 'tab', sessionId = 'session', owner = 'server-a') {
  native.request.mockResolvedValueOnce({ owner, path: '/', entries: [] })
  await useFiles().navigate(tabId, sessionId, '/')
}
/** Opens `/config` in a connected explorer and edits it into an unsaved draft. */
export async function draft(tabId = 'tab', content = 'draft', path = '/config') {
  await connect(tabId)
  native.request.mockResolvedValueOnce({ ...remoteText(), path, resolvedPath: path })
  await useFiles().openDocument(tabId, 'session', path)
  const document = useFiles()
    .state(tabId)
    .documents.find((doc) => doc.path === path)!
  document.content = content
  return document
}

beforeEach(() => {
  Object.values(native).forEach((mock) => mock.mockReset())
  native.stageDiscard.mockResolvedValue(undefined)
  setActivePinia(createPinia())
})
