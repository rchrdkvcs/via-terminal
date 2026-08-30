import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defaultSettings, type AppData } from '@/ipc/types'

const native = vi.hoisted(() => ({ next: 0 }))
vi.mock('@/ipc/client', () => ({
  isNative: () => true,
  describeError: (error: unknown) => String(error),
  api: {
    spawnSession: vi.fn(async () => ({ id: `session-${++native.next}` })),
    saveTab: vi.fn(async (tab) => tab),
    saveSplitGroup: vi.fn(async (group) => group),
    deleteSplitGroup: vi.fn(async () => undefined),
    deleteTab: vi.fn(async () => undefined),
    closeSession: vi.fn(async () => undefined),
  },
}))

import { useAppStore } from './app'

const WORKSPACE = 'workspace'
const PROFILE = 'profile'

function snapshot(): AppData {
  return {
    workspaces: [
      {
        id: WORKSPACE,
        name: 'Personnel',
        icon: 'terminal',
        color: '#7c6ef6',
        position: 0,
        defaultProfileId: PROFILE,
      },
    ],
    profiles: [
      {
        id: PROFILE,
        workspaceId: WORKSPACE,
        name: 'PowerShell',
        executable: 'powershell.exe',
        args: [],
        workingDirectory: null,
      },
    ],
    resources: [],
    identities: [],
    sidebarNodes: [],
    favorites: [],
    savedSessions: [],
    tabs: [],
    splitGroups: [],
    windows: [],
    settings: { ...defaultSettings },
    appState: { cleanShutdown: true, recoveryAvailable: false },
  }
}

describe('application sidebar lifecycle', () => {
  beforeEach(() => {
    native.next = 0
    setActivePinia(createPinia())
  })

  it('pins the same temporary tab instead of creating a second row', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    await store.createTerminal()
    const id = store.activeTabId

    await store.pinTab(id)

    expect(store.tabs.filter((tab) => tab.id === id)).toHaveLength(1)
    expect(store.pinnedTabs.map((tab) => tab.id)).toEqual([id])
    expect(store.unfavoritedTabs).toHaveLength(0)
  })

  it('creates linked splits as distinct tabs and sessions', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    await store.createTerminal()
    const originalTab = store.activeTabId
    const originalSession = store.activeSession?.id

    await store.splitActivePane('vertical')

    expect(store.tabs).toHaveLength(2)
    expect(new Set(store.tabs.map((tab) => tab.id)).size).toBe(2)
    expect(new Set(store.sessions.map((session) => session.id)).size).toBe(2)
    expect(store.splitGroups[0].tabIds).toContain(originalTab)
    expect(store.sessions.map((session) => session.id)).toContain(originalSession)
  })

  it('does not restore temporary tabs from a snapshot', () => {
    const store = useAppStore()
    const data = snapshot()
    data.savedSessions.push({
      id: 'session',
      workspaceId: WORKSPACE,
      targetKind: 'profile',
      targetId: PROFILE,
      workingDirectory: null,
    })
    data.tabs.push({
      id: 'temporary',
      workspaceId: WORKSPACE,
      name: 'Temporary',
      root: { kind: 'pane', sessionId: 'session' },
      position: 0,
      organized: false,
    })
    store.applySnapshot(data)

    expect(store.tabs).toHaveLength(0)
  })
})
