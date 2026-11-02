import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type EffectScope, effectScope, nextTick, reactive } from 'vue'
import type { Tab } from '@/ipc/types'

const state = vi.hoisted(() => ({
  mode: 'off' as 'off' | 'panel' | 'tab',
  tabs: [] as Tab[],
  active: undefined as Tab | undefined,
  runtimes: {} as Record<string, { state: string; sessionId: string | null }>,
  setVisible: vi.fn(),
  openView: vi.fn(),
}))
const live = reactive({ active: undefined as Tab | undefined, runtimes: state.runtimes })

vi.mock('@/stores/files', () => ({ useFiles: () => ({ setVisible: state.setVisible }) }))
vi.mock('@/stores/settings', () => ({
  useSettings: () => ({
    settings: {
      get filesAutoOpen() {
        return state.mode
      },
    },
  }),
}))
vi.mock('@/stores/sessions', () => ({
  useSessions: () => ({
    runtime: (id: string) => live.runtimes[id] ?? { state: 'asleep', sessionId: null },
  }),
}))
vi.mock('@/stores/spaces', () => ({
  useSpaces: () => ({
    spaceOf: () => ({ pinned: [], temporary: state.tabs.map((tab) => ({ kind: 'tab', ...tab })) }),
  }),
}))
vi.mock('@/stores/workbench', () => ({
  useWorkbench: () => ({
    get activeTab() {
      return live.active
    },
    openView: state.openView,
  }),
}))

const { useFilesAutoOpen } = await import('./useFilesAutoOpen')

const ssh: Tab = {
  id: 'ssh',
  title: null,
  target: { kind: 'host', hostId: 'h' },
  remoteCwd: '/srv',
}

async function connect(sessionId = 's1') {
  live.runtimes.ssh = { state: 'ready', sessionId }
  await nextTick()
}

let scope: EffectScope
beforeEach(() => {
  vi.clearAllMocks()
  state.tabs = [ssh]
  for (const key of Object.keys(live.runtimes)) delete live.runtimes[key]
  live.active = ssh
  scope = effectScope()
  scope.run(() => useFilesAutoOpen())
})
afterEach(() => scope.stop())

describe('remote explorer auto-open', () => {
  it('does nothing when off', async () => {
    state.mode = 'off'
    await connect()
    expect(state.setVisible).not.toHaveBeenCalled()
    expect(state.openView).not.toHaveBeenCalled()
  })

  it('shows the side panel once per connection', async () => {
    state.mode = 'panel'
    await connect('s1')
    live.runtimes.ssh = { state: 'disconnected', sessionId: null }
    await nextTick()
    await connect('s1')
    expect(state.setVisible).toHaveBeenCalledExactlyOnceWith('ssh', true)
    await connect('s2')
    expect(state.setVisible).toHaveBeenCalledTimes(2)
  })

  it('adds an explorer tab at the terminal directory without taking the focus', async () => {
    state.mode = 'tab'
    await connect()
    expect(state.openView).toHaveBeenCalledExactlyOnceWith(
      ssh,
      { kind: 'files', path: '/srv' },
      { activate: false },
    )
  })

  it('reuses an explorer tab of the same target already in the space', async () => {
    state.mode = 'tab'
    state.tabs = [ssh, { ...ssh, id: 'files', view: { kind: 'files', path: null } }]
    await connect()
    expect(state.openView).not.toHaveBeenCalled()
  })

  it('ignores local terminals', async () => {
    state.mode = 'panel'
    live.active = { id: 'ssh', title: null, target: { kind: 'local', shell: null, cwd: null } }
    await connect()
    expect(state.setVisible).not.toHaveBeenCalled()
  })
})
