import { beforeEach, vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { reactive } from 'vue'
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
/**
 * Stands in for the sessions store under the same id, so `useSessions()` returns it: each
 * tab's ready session, driven by `ready` and `end`, and no session events.
 */
const useSessionsFake = defineStore('sessions', () => {
  const ready = reactive<Record<string, string>>({})
  const runtime = (tabId: string) => ({
    state: ready[tabId] ? 'ready' : 'asleep',
    sessionId: ready[tabId] ?? null,
  })
  const subscribe = () => () => undefined
  return { ready, runtime, onEnded: subscribe, onHostSaved: subscribe }
})
/** The tab's session becomes ready, replacing any previous one. */
export function ready(tabId = 'tab', sessionId = 'session') {
  useSessionsFake().ready[tabId] = sessionId
}
/** The tab's session ends. */
export function end(tabId = 'tab') {
  delete useSessionsFake().ready[tabId]
}
/** Lists `/` as `owner` through a ready `sessionId`, so the explorer is connected and owned. */
export async function connect(tabId = 'tab', sessionId = 'session', owner = 'server-a') {
  ready(tabId, sessionId)
  native.request.mockResolvedValueOnce({ owner, path: '/', entries: [] })
  await useFiles().navigate(tabId, '/')
}
/** Opens `/config` as `owner` in a ready document tab and edits it into an unsaved draft. */
export async function draft(tabId = 'tab', content = 'draft', owner = 'server-a') {
  ready(tabId)
  native.request.mockResolvedValueOnce(remoteText('old', owner))
  await useFiles().openDocument(tabId, '/config')
  const document = useFiles().document(tabId)!
  document.content = content
  return document
}
/**
 * The document tab reconnects through `sessionId` and, as its editor does, reads the
 * document again: the server answers as `owner` with `remote` contents.
 */
export async function reconnect(
  tabId = 'tab',
  sessionId = 'session-2',
  owner = 'server-a',
  remote = 'old',
) {
  ready(tabId, sessionId)
  native.request.mockResolvedValueOnce(remoteText(remote, owner))
  await useFiles().openDocument(tabId, '/config')
}

beforeEach(() => {
  Object.values(native).forEach((mock) => mock.mockReset())
  native.stageDiscard.mockResolvedValue(undefined)
  setActivePinia(createPinia())
  useSessionsFake()
})
