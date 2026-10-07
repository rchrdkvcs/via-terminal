import { afterEach, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Layout, Row, Target } from '@/ipc/types'
import { useSpaces } from './spaces'
import { useWorkbench } from './workbench'

const mocks = vi.hoisted(() => ({
  live: new Set<string>(),
  start: vi.fn(),
  stop: vi.fn(),
  release: vi.fn(),
  focus: vi.fn(),
  onEnded: vi.fn(),
  onHostSaved: vi.fn(),
  stopEnded: vi.fn(),
  stopHostSaved: vi.fn(),
  tabOf: vi.fn(),
  saveLayout: vi.fn(),
  eventHandlers: new Map<string, (payload: never) => void>(),
}))
export { mocks }
vi.mock('./sessions', () => ({
  useSessions: () => ({
    start: mocks.start,
    stop: mocks.stop,
    release: mocks.release,
    isLive: (id: string) => mocks.live.has(id),
    runtime: (id: string) =>
      mocks.live.has(id) ? { state: 'ready', sessionId: 'session' } : { state: 'asleep' },
    onEnded: mocks.onEnded,
    onHostSaved: mocks.onHostSaved,
    tabOf: mocks.tabOf,
  }),
}))
vi.mock('@/terminal/registry', () => ({ terminals: { focus: mocks.focus } }))
vi.mock('@/ipc/client', () => ({
  api: { saveLayout: mocks.saveLayout },
  describeError: String,
  errorCode: (cause: { code?: string }) => cause.code ?? null,
}))
vi.mock('@/lib/notify', () => ({ notify: { error: vi.fn() } }))
vi.mock('@/ipc/events', () => ({
  on: (name: string, handler: (payload: never) => void) => mocks.eventHandlers.set(name, handler),
}))

export const target: Target = { kind: 'local', shell: null, cwd: null }
export const row = (id: string): Extract<Row, { kind: 'tab' }> => ({
  kind: 'tab',
  id,
  title: null,
  target: { ...target },
})
export const split = (
  id: string,
  ids: string[],
  direction: 'horizontal' | 'vertical' = 'horizontal',
): Row => ({
  kind: 'split',
  id,
  direction,
  sizes: ids.map(() => 1),
  tabs: ids.map((id) => ({ id, title: null, target: { ...target } })),
})
export function setup(pinned: Row[] = [], temporary: Row[] = [], secondPinned: Row[] = []) {
  const layout: Layout = {
    activeSpaceId: 'one',
    sidebar: { visible: true, width: 264 },
    spaces: [
      { id: 'one', name: 'One', icon: 'terminal', defaultShell: 'first-shell', pinned },
      {
        id: 'two',
        name: 'Two',
        icon: 'terminal',
        defaultShell: 'second-shell',
        pinned: secondPinned,
      },
    ],
  }
  const spaces = useSpaces()
  spaces.hydrate(layout)
  spaces.byId('one')!.temporary = temporary
  return { spaces, workbench: useWorkbench() }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.live.clear()
  mocks.eventHandlers.clear()
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  )
  mocks.onEnded.mockReturnValue(mocks.stopEnded)
  mocks.onHostSaved.mockReturnValue(mocks.stopHostSaved)
  mocks.saveLayout.mockResolvedValue(undefined)
  mocks.start.mockImplementation((tab: { id: string }) => {
    mocks.live.add(tab.id)
  })
  mocks.stop.mockImplementation((id: string) => {
    mocks.live.delete(id)
  })
  mocks.release.mockImplementation((id: string) => {
    mocks.live.delete(id)
  })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
