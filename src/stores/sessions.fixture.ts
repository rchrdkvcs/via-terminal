import { beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SessionStateEvent, Size, Tab } from '@/ipc/types'

const mocks = vi.hoisted(() => ({
  measure: vi.fn(),
  feed: vi.fn(),
  release: vi.fn(),
  openLocal: vi.fn(),
  write: vi.fn(),
  close: vi.fn(),
  handlers: new Map<string, (payload: never) => void>(),
}))
export { mocks }

vi.mock('@/terminal/registry', () => ({
  terminals: { measure: mocks.measure, feed: mocks.feed, release: mocks.release },
}))
vi.mock('@/ipc/client', () => ({
  api: { session: { openLocal: mocks.openLocal, write: mocks.write, close: mocks.close } },
  describeError: (cause: Error) => cause.message,
}))
vi.mock('@/ipc/events', () => ({
  on: (name: string, handler: (payload: never) => void) => {
    mocks.handlers.set(name, handler)
    return () => mocks.handlers.delete(name)
  },
}))

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export const tab: Tab = {
  id: 'tab',
  title: null,
  target: { kind: 'local', shell: null, cwd: null },
}
export const size: Size = { cols: 80, rows: 24 }
export function state(sessionId: string, value: SessionStateEvent['state']) {
  mocks.handlers.get('session-state')!({
    sessionId,
    state: value,
    message: null,
    exitCode: null,
    reason: null,
  } as never)
}
export function output(sessionId: string) {
  mocks.handlers.get('terminal-output')!({ sessionId, dataBase64: 'aGk=' } as never)
}
export function prompt(sessionId: string) {
  mocks.handlers.get('session-prompt')!({
    sessionId,
    promptId: 'prompt',
    prompt: { kind: 'username', address: 'host' },
  } as never)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.handlers.clear()
  setActivePinia(createPinia())
  mocks.measure.mockResolvedValue(size)
  mocks.close.mockResolvedValue(undefined)
  mocks.write.mockResolvedValue(undefined)
})
