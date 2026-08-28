import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AppData } from '@/ipc/types'
import { defaultSettings } from '@/ipc/types'

const spawned: string[] = []
const closed: string[] = []
const savedTabs: unknown[] = []

const listeners = new Map<string, (event: { payload: unknown }) => void>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    listeners.set(name, handler)
    return () => listeners.delete(name)
  }),
}))

function emit(name: string, payload: unknown) {
  listeners.get(name)?.({ payload })
}
vi.mock('@/ipc/client', async () => {
  const actual = await vi.importActual<typeof import('@/ipc/client')>('@/ipc/client')
  let counter = 0
  return {
    ...actual,
    isNative: () => true,
    api: {
      snapshot: vi.fn(async () => snapshot()),
      isLocked: vi.fn(async () => false),
      recoveryState: vi.fn(async () => ({ cleanShutdown: true, recoveryAvailable: false })),
      finishRecovery: vi.fn(async () => undefined),
      detectProfiles: vi.fn(async () => ['powershell.exe']),
      spawnSession: vi.fn(async () => {
        counter += 1
        const id = `session-${counter}`
        spawned.push(id)
        return { id }
      }),
      connectSsh: vi.fn(async () => {
        counter += 1
        const sessionId = `session-${counter}`
        spawned.push(sessionId)
        return {
          sessionId,
          resolved: {
            destination: 'prod',
            host: 'prod.example.net',
            user: 'ops',
            port: 22,
            identityFiles: [],
          },
        }
      }),
      closeSession: vi.fn(async (id: string) => {
        closed.push(id)
      }),
      resizeSession: vi.fn(async () => undefined),
      writeSession: vi.fn(async () => undefined),
      saveTab: vi.fn(async (tab: unknown) => {
        savedTabs.push(tab)
        return tab
      }),
      deleteTab: vi.fn(async () => undefined),
      saveWindowState: vi.fn(async (value: unknown) => value),
      updateSettings: vi.fn(async (value: unknown) => value),
    },
  }
})

vi.mock('@/terminal/registry', () => ({
  terminals: {
    lastKnownSize: { cols: 80, rows: 24 },
    attach: vi.fn(),
    detach: vi.fn(),
    focus: vi.fn(),
    release: vi.fn(),
    releaseAll: vi.fn(),
    rebind: vi.fn(),
    requestFit: vi.fn(),
    search: vi.fn(),
    setPresentation: vi.fn(),
    has: vi.fn(() => true),
  },
  describeError: (error: unknown) => String(error),
}))

const { useAppStore } = await import('./app')

const WORKSPACE_A = 'ws-a'
const WORKSPACE_B = 'ws-b'
const PROFILE_A = 'profile-a'
const PROFILE_B = 'profile-b'
const RESOURCE_A = 'resource-a'
const IDENTITY_A = 'identity-a'

function snapshot(): AppData {
  return {
    workspaces: [
      {
        id: WORKSPACE_A,
        name: 'Support',
        icon: 'terminal',
        color: '#7c6ef6',
        position: 0,
        defaultProfileId: PROFILE_A,
      },
      {
        id: WORKSPACE_B,
        name: 'Infrastructure',
        icon: 'server',
        color: '#67e8f9',
        position: 1,
        defaultProfileId: PROFILE_B,
      },
    ],
    profiles: [
      {
        id: PROFILE_A,
        workspaceId: WORKSPACE_A,
        name: 'PowerShell',
        executable: 'powershell.exe',
        args: [],
        workingDirectory: null,
      },
      {
        id: PROFILE_B,
        workspaceId: WORKSPACE_B,
        name: 'Ubuntu',
        executable: 'wsl.exe',
        args: [],
        workingDirectory: null,
      },
    ],
    resources: [
      {
        id: RESOURCE_A,
        workspaceId: WORKSPACE_A,
        name: 'Production',
        sshAlias: 'prod',
        host: null,
        port: null,
        identityId: IDENTITY_A,
      },
    ],
    identities: [
      {
        id: IDENTITY_A,
        workspaceId: WORKSPACE_A,
        name: 'ops',
        username: 'ops',
        identityFile: null,
      },
    ],
    sidebarNodes: [
      {
        id: 'node-folder',
        workspaceId: WORKSPACE_A,
        parentId: null,
        kind: 'folder',
        label: 'Clients',
        targetId: null,
        position: 0,
      },
      {
        id: 'node-resource',
        workspaceId: WORKSPACE_A,
        parentId: 'node-folder',
        kind: 'resource',
        label: 'Production',
        targetId: RESOURCE_A,
        position: 0,
      },
      {
        id: 'node-profile',
        workspaceId: WORKSPACE_A,
        parentId: null,
        kind: 'profile',
        label: 'PowerShell',
        targetId: PROFILE_A,
        position: 1,
      },
    ],
    favorites: [
      {
        id: 'fav-a',
        workspaceId: WORKSPACE_A,
        targetKind: 'profile',
        targetId: PROFILE_A,
        position: 0,
      },
    ],
    savedSessions: [],
    tabs: [],
    windows: [],
    settings: { ...defaultSettings },
    appState: { cleanShutdown: true, recoveryAvailable: false },
  }
}

async function bootedStore() {
  const store = useAppStore()
  await store.initialize()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  spawned.length = 0
  closed.length = 0
  savedTabs.length = 0
})

describe('snapshot ingestion', () => {
  it('builds the sidebar tree of the active workspace only', async () => {
    const store = await bootedStore()
    expect(store.activeWorkspaceId).toBe(WORKSPACE_A)
    expect(store.tree.map((node) => node.label)).toEqual(['Clients', 'PowerShell'])
    expect(store.tree[0].children[0]).toMatchObject({ label: 'Production', depth: 1 })

    store.switchWorkspace(WORKSPACE_B)
    expect(store.tree).toEqual([])
  })

  it('resolves favorites through their target record', async () => {
    const store = await bootedStore()
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0]).toMatchObject({ name: 'PowerShell', targetKind: 'profile' })
  })
})

describe('sessions and tabs', () => {
  it('opens a local terminal on the workspace default profile', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    expect(spawned).toHaveLength(1)
    expect(store.visibleTabs).toHaveLength(1)
    expect(store.activeSession).toMatchObject({
      kind: 'local',
      targetId: PROFILE_A,
      workspaceId: WORKSPACE_A,
      status: 'connected',
    })
  })

  it('uses the session identifier returned by ssh_session_connect', async () => {
    const store = await bootedStore()
    await store.openTarget('resource', RESOURCE_A)
    expect(store.activeSession).toMatchObject({
      id: spawned[0],
      kind: 'ssh',
      detail: 'ops@prod.example.net:22',
    })
  })

  it('focuses an already open target instead of spawning a second session', async () => {
    const store = await bootedStore()
    await store.openTarget('profile', PROFILE_A)
    await store.openTarget('profile', PROFILE_A)
    expect(spawned).toHaveLength(1)
    expect(store.visibleTabs).toHaveLength(1)
  })

  it('opens a second session when reuse is refused', async () => {
    const store = await bootedStore()
    await store.openTarget('profile', PROFILE_A)
    await store.openTarget('profile', PROFILE_A, { reuse: false })
    expect(spawned).toHaveLength(2)
    expect(store.visibleTabs).toHaveLength(2)
  })

  it('keeps sessions alive and remembers the tab of each workspace', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const first = store.activeTabId

    store.switchWorkspace(WORKSPACE_B)
    expect(store.activeTab).toBeNull()
    await store.createTerminal()
    const second = store.activeTabId

    store.switchWorkspace(WORKSPACE_A)
    expect(store.activeTabId).toBe(first)
    store.switchWorkspace(WORKSPACE_B)
    expect(store.activeTabId).toBe(second)
    expect(store.sessions).toHaveLength(2)
    expect(closed).toEqual([])
  })

  it('asks before closing a tab that still owns live sessions', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const tabId = store.activeTabId

    await store.closeTab(tabId)
    expect(store.pendingTabClose).toBe(tabId)
    expect(store.visibleTabs).toHaveLength(1)

    await store.closeTab(tabId, { force: true })
    expect(store.visibleTabs).toHaveLength(0)
    expect(closed).toEqual(spawned)
  })
})

describe('pane splitting', () => {
  it('splits the active pane and keeps the original session', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const original = store.activeSession?.id

    await store.splitActivePane('vertical')
    const root = store.activeTab?.root
    expect(root?.kind).toBe('split')
    if (root?.kind !== 'split') throw new Error('expected a split')
    expect(root.direction).toBe('vertical')
    expect(store.paneSessionIds(root)).toEqual([original, spawned[1]])
  })

  it('collapses the split back into its sibling when a pane closes', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const original = store.activeSession?.id
    await store.splitActivePane('horizontal')

    const root = store.activeTab?.root
    if (root?.kind !== 'split') throw new Error('expected a split')
    await store.closePane(root.second.id)

    expect(store.activeTab?.root.kind).toBe('pane')
    expect(store.paneSessionIds(store.activeTab!.root)).toEqual([original])
    expect(closed).toEqual([spawned[1]])
  })

  it('clamps a split ratio to a usable range', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    await store.splitActivePane('vertical')
    const root = store.activeTab?.root
    if (root?.kind !== 'split') throw new Error('expected a split')

    store.setSplitRatio(root.id, 0.01)
    const updated = store.activeTab?.root
    if (updated?.kind !== 'split') throw new Error('expected a split')
    expect(updated.ratio).toBe(0.15)
  })
})

describe('ssh lifecycle', () => {
  it('follows an automatic retry onto its replacement session', async () => {
    const store = await bootedStore()
    const unbind = store.bindNativeEvents()
    await store.openTarget('resource', RESOURCE_A)
    const original = store.activeSession!.id
    const { terminals } = await import('@/terminal/registry')

    emit('ssh-state-changed', {
      sessionId: original,
      status: 'reconnecting',
      attempt: 1,
      replacementSessionId: null,
    })
    expect(store.activeSession?.status).toBe('reconnecting')

    emit('ssh-state-changed', {
      sessionId: original,
      status: 'connected',
      attempt: 1,
      replacementSessionId: 'session-replacement',
    })
    expect(store.activeSession?.status).toBe('connected')
    expect(store.activeSession?.id).toBe('session-replacement')
    expect(terminals.rebind).toHaveBeenCalledWith(original, 'session-replacement')
    expect(store.paneSessionIds(store.activeTab!.root)).toEqual(['session-replacement'])
    unbind()
  })

  it('marks an exited local shell as closed without dropping its pane', async () => {
    const store = await bootedStore()
    const unbind = store.bindNativeEvents()
    await store.createTerminal()
    const sessionId = store.activeSession!.id

    emit('session-exited', { sessionId })
    expect(store.activeSession?.status).toBe('closed')
    expect(store.visibleTabs).toHaveLength(1)
    unbind()
  })
})

describe('restorable layout', () => {
  it('restores panes as placeholders without starting anything', async () => {
    const store = useAppStore()
    const data = snapshot()
    data.savedSessions = [
      {
        id: 'saved-1',
        workspaceId: WORKSPACE_A,
        targetKind: 'resource',
        targetId: RESOURCE_A,
        workingDirectory: null,
      },
    ]
    data.tabs = [
      {
        id: 'tab-1',
        workspaceId: WORKSPACE_A,
        name: 'Production',
        root: { kind: 'pane', sessionId: 'saved-1' },
        position: 0,
      },
    ]
    store.applySnapshot(data)
    await store.dismissRecovery(true)

    expect(spawned).toEqual([])
    expect(store.visibleTabs).toHaveLength(1)
    expect(store.activeSession).toMatchObject({ status: 'restorable', name: 'Production' })

    await store.activateRestorableSession('saved-1')
    expect(spawned).toHaveLength(1)
    expect(store.activeSession).toMatchObject({ status: 'connected', id: spawned[0] })
  })
})
