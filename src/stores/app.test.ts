import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AppData } from '@/ipc/types'
import { defaultSettings } from '@/ipc/types'
import { readFileSync } from 'node:fs'

const spawned: string[] = []
const closed: string[] = []
const savedTabs: unknown[] = []
/** Every reordering call sent to the backend, to assert the resolved index. */
const moves: Array<Record<string, unknown>> = []

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
      createSidebarNode: vi.fn(
        async (
          workspaceId: string,
          kind: string,
          label: string,
          parentId: string | null,
          targetId: string | null,
        ) => {
          const node = {
            id: `node-new-${++counter}`,
            workspaceId,
            parentId,
            kind,
            label,
            targetId,
            position: 0,
          }
          moves.push({ call: 'create', id: node.id, parentId })
          return node
        },
      ),
      moveSidebarNode: vi.fn(async (id: string, parentId: string | null, position: number) => {
        moves.push({ call: 'move', id, parentId, position })
        return { id, parentId, position }
      }),
      setFavorite: vi.fn(async (_ws: string, _kind: string, targetId: string, pinned: boolean) => {
        moves.push({ call: 'favorite', targetId, pinned })
      }),
      moveFavorite: vi.fn(async (id: string, position: number) => {
        moves.push({ call: 'moveFavorite', id, position })
      }),
      updateWorkspace: vi.fn(async (id: string, name: string, icon: string) => ({
        ...snapshot().workspaces.find((workspace) => workspace.id === id)!,
        name,
        icon,
      })),
      deleteWorkspace: vi.fn(async (id: string) => {
        moves.push({ call: 'deleteWorkspace', id })
      }),
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
const { finishTabMove } = await import('@/lib/tab-dnd')

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
  moves.length = 0
  window.localStorage?.clear()
})

describe('snapshot ingestion', () => {
  it('builds the sidebar tree of the active workspace only', async () => {
    const store = await bootedStore()
    expect(store.activeWorkspaceId).toBe(WORKSPACE_A)
    expect(store.tree.map((node) => node.label)).toEqual(['Clients'])
    expect(store.tree[0].children[0]).toMatchObject({ label: 'Production', depth: 1 })

    store.switchWorkspace(WORKSPACE_B)
    expect(store.tree).toEqual([])
  })

  it('keeps local launch profiles off the sidebar', async () => {
    const store = await bootedStore()
    expect(store.favorites).toEqual([])
    expect(
      store.tree.flatMap((node) => [node, ...node.children]).map((node) => node.kind),
    ).not.toContain('profile')
  })

  it('exposes a resource favorite as a pinned row above the tree', async () => {
    const store = useAppStore()
    const data = snapshot()
    data.favorites = [
      {
        id: 'fav-a',
        workspaceId: WORKSPACE_A,
        targetKind: 'resource',
        targetId: RESOURCE_A,
        position: 0,
      },
    ]
    store.applySnapshot(data)

    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0]).toMatchObject({
      label: 'Production',
      kind: 'resource',
      targetId: RESOURCE_A,
      depth: 0,
    })
    expect(store.isFavorite(RESOURCE_A)).toBe(true)
    expect(
      store.tree.flatMap((node) => [node, ...node.children]).map((node) => node.targetId),
    ).not.toContain(RESOURCE_A)
  })
})

describe('workspace sidebar navigation', () => {
  it('persists collapsed folders per workspace', async () => {
    const store = await bootedStore()
    expect(store.isFolderCollapsed('node-folder')).toBe(false)
    store.toggleFolder('node-folder')
    expect(store.isFolderCollapsed('node-folder')).toBe(true)

    store.switchWorkspace(WORKSPACE_B)
    expect(store.isFolderCollapsed('node-folder')).toBe(false)
    store.switchWorkspace(WORKSPACE_A)
    expect(store.isFolderCollapsed('node-folder')).toBe(true)
  })

  it('renames and changes the icon without replacing workspace state', async () => {
    const store = await bootedStore()
    await store.updateWorkspace(WORKSPACE_A, { name: 'Assistance', icon: 'server' })
    expect(store.activeWorkspace).toMatchObject({ name: 'Assistance', icon: 'server' })
    expect(store.activeWorkspaceId).toBe(WORKSPACE_A)
  })

  it('marks the direction of an animated workspace change', async () => {
    const store = await bootedStore()
    store.switchWorkspace(WORKSPACE_B)
    expect(store.isSwitchingWorkspace).toBe(true)
    expect(store.workspaceSwitchDirection).toBe(1)
  })

  it('deletes a workspace and refuses to delete the last one', async () => {
    const store = await bootedStore()
    await store.deleteWorkspace(WORKSPACE_B)
    expect(moves.some((item) => item.call === 'deleteWorkspace' && item.id === WORKSPACE_B)).toBe(
      true,
    )

    const only = snapshot()
    only.workspaces = only.workspaces.filter((workspace) => workspace.id === WORKSPACE_A)
    store.applySnapshot(only)
    moves.length = 0
    await store.deleteWorkspace(WORKSPACE_A)
    expect(moves).toEqual([])
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

  it('keeps every new terminal as a temporary open tab without a saved-target counter', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    await store.createTerminal()
    await store.createTerminal()

    expect(store.unfavoritedTabs).toHaveLength(3)
    expect(store.favorites).toEqual([])
  })

  it('pins a tab by moving it above the divider without duplicating it', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const tabId = store.activeTabId

    await store.pinTab(tabId)

    expect(store.pinnedTabs.map((tab) => tab.id)).toEqual([tabId])
    expect(store.unfavoritedTabs.map((tab) => tab.id)).toEqual([])
    expect(store.visibleTabs).toHaveLength(1)
    expect(moves.filter((item) => item.call === 'favorite')).toEqual([])
  })

  it('unpins a tab back into the open list', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const tabId = store.activeTabId
    await store.pinTab(tabId)
    await store.unpinTab(tabId)

    expect(store.pinnedTabs).toEqual([])
    expect(store.unfavoritedTabs.map((tab) => tab.id)).toEqual([tabId])
  })

  it('pinning an already pinned tab does not create a second row', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const tabId = store.activeTabId
    await store.pinTab(tabId)
    await store.pinTab(tabId)

    expect(store.pinnedTabs).toHaveLength(1)
    expect(store.visibleTabs).toHaveLength(1)
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
    await store.openTarget('resource', RESOURCE_A)
    await store.openTarget('resource', RESOURCE_A)
    expect(spawned).toHaveLength(1)
    expect(store.visibleTabs).toHaveLength(1)
  })

  it('opens a saved SSH resource as a unique tab, not a second open-tab row', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    expect(store.unfavoritedTabs).toHaveLength(1)

    await store.openTarget('resource', RESOURCE_A)

    expect(store.activeSession).toMatchObject({
      kind: 'ssh',
      targetId: RESOURCE_A,
      status: 'connected',
    })
    expect(store.isTargetActive(RESOURCE_A)).toBe(true)
    // The tree row is the unique instance; the open list stays the local tab.
    expect(store.unfavoritedTabs).toHaveLength(1)
    expect(store.unfavoritedTabs[0].id).not.toBe(store.activeTabId)
    expect(store.pinnedTabs).toEqual([])
    expect(store.visibleTabs).toHaveLength(2)
  })

  it('opens a second session when reuse is refused', async () => {
    const store = await bootedStore()
    await store.openTarget('resource', RESOURCE_A)
    await store.openTarget('resource', RESOURCE_A, { reuse: false })
    expect(spawned).toHaveLength(2)
    expect(store.visibleTabs).toHaveLength(2)
    // Only the extra instance lands in the open list; the saved SSH stays unique.
    expect(store.unfavoritedTabs).toHaveLength(1)
    expect(store.activeSession?.id).toBe(spawned[1])
  })

  it('starts the CLI when the unique saved SSH tab is only restorable', async () => {
    const store = useAppStore()
    const data = snapshot()
    data.savedSessions = [
      {
        id: 'sess-rest',
        workspaceId: WORKSPACE_A,
        targetKind: 'resource',
        targetId: RESOURCE_A,
        workingDirectory: null,
      },
    ]
    data.tabs = [
      {
        id: 'tab-rest',
        workspaceId: WORKSPACE_A,
        name: 'Production',
        root: { kind: 'pane', sessionId: 'sess-rest' },
        position: 0,
        organized: false,
      },
    ]
    store.applySnapshot(data)
    await store.dismissRecovery(true)

    expect(store.activeSession).toMatchObject({ id: 'sess-rest', status: 'restorable' })
    expect(store.unfavoritedTabs).toHaveLength(0)

    await store.openTarget('resource', RESOURCE_A)

    expect(spawned).toHaveLength(1)
    expect(store.activeSession).toMatchObject({
      id: spawned[0],
      status: 'connected',
      targetId: RESOURCE_A,
    })
    expect(store.visibleTabs).toHaveLength(1)
    expect(store.unfavoritedTabs).toHaveLength(0)
  })

  it('recreates the unique SSH tab after its instance is closed', async () => {
    const store = await bootedStore()
    await store.openTarget('resource', RESOURCE_A)
    const tabId = store.activeTabId
    await store.closeTab(tabId, { force: true })

    expect(store.visibleTabs).toHaveLength(0)
    expect(store.tree[0].children[0].targetId).toBe(RESOURCE_A)

    await store.openTarget('resource', RESOURCE_A)
    expect(store.activeSession?.targetId).toBe(RESOURCE_A)
    expect(store.visibleTabs).toHaveLength(1)
    expect(store.unfavoritedTabs).toHaveLength(0)
    expect(store.activeTabId).not.toBe(tabId)
  })

  it('marks only the target of the active tab as selected', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const localTab = store.activeTabId
    await store.openTarget('resource', RESOURCE_A)

    expect(store.isTargetActive(RESOURCE_A)).toBe(true)
    expect(store.isTargetActive(PROFILE_A)).toBe(false)

    store.selectTab(localTab)
    expect(store.isTargetActive(RESOURCE_A)).toBe(false)
    expect(store.activeTabId).toBe(localTab)
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

describe('desktop shell regressions', () => {
  it('grants the native titlebar actions used by the custom header', () => {
    const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'))
    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        'core:window:allow-minimize',
        'core:window:allow-toggle-maximize',
        'core:window:allow-close',
        'core:window:allow-start-dragging',
      ]),
    )
  })

  it('keeps the header balanced and the edge reveal immediate', () => {
    const topBar = readFileSync('src/components/workspace/TopBar.vue', 'utf8')
    const app = readFileSync('src/App.vue', 'utf8')
    expect(topBar).toContain('grid-cols-3')
    expect(topBar).toContain('window.startDragging()')
    expect(topBar).not.toContain('@mousedown.left="startDragging"')
    expect(topBar).toContain('@pointerdown="prepareDragging"')
    expect(app).toContain('sidebarRevealDelay')
    expect(app).toContain('scheduleReveal')
    expect(app).toContain('scheduleHide')
    expect(app).toContain('cursor-ew-resize')
    expect(app).toContain('bg-background')
    expect(app).toContain('group-hover:opacity-100')
    expect(app).toContain('rounded-xl border border-border/50 bg-background')
    expect(app).not.toContain('group-hover:bg-neutral-900')
  })

  it('keeps a single pinned section above the divider and open tabs below it', () => {
    const sidebar = readFileSync('src/components/sidebar/AppSidebar.vue', 'utf8')
    const rows = readFileSync('src/components/sidebar/SessionRows.vue', 'utf8')
    const tabRow = readFileSync('src/components/sidebar/TabRow.vue', 'utf8')
    const markup = sidebar.slice(sidebar.indexOf('<template>'))
    expect(markup.indexOf('<SessionRows pinned')).toBeLessThan(markup.indexOf('<SidebarSeparator'))
    expect(markup.indexOf('<SidebarSeparator')).toBeLessThan(markup.lastIndexOf('<SessionRows'))
    expect(markup).not.toContain('store.favorites')
    expect(markup).toContain('store.tree')
    expect(tabRow).toContain('bg-state-online')
    const tree = readFileSync('src/components/sidebar/SidebarTree.vue', 'utf8')
    expect(tree).toContain('uniqueTabForTarget')
    expect(tree).toContain('reuse: !(event.ctrlKey || event.shiftKey)')
    expect(tree).toContain('Fermer')
    expect(tree).not.toContain('MoreHorizontal')
    expect(rows).toContain('Nouveau terminal')
    expect(rows).toContain('v-draggable="[rows, tabSortableOptions()]"')
    expect(rows).toContain('<TabRow')
    expect(tree).toContain('<TabRow')
    expect(tabRow).toContain('Épingler')
    expect(tabRow).toContain('Détacher')
    expect(rows).not.toContain('Épingler dans l’espace')
    expect(rows).not.toContain('Épingler en haut')
    expect(rows).not.toContain('row.panes')
    expect(rows).not.toContain('renamingTabId')
    expect(sidebar).toContain('Déposer ici pour épingler')
    expect(tree).toContain('@dragover="onDragOver($event, node)"')
    const palette = readFileSync('src/components/CommandPalette.vue', 'utf8')
    expect(palette).toContain('bg-neutral-950')
    const commandDialog = readFileSync('src/components/ui/command/CommandDialog.vue', 'utf8')
    expect(commandDialog).toContain('sm:max-w-2xl')
  })

  it('switches workspace on a left click and does not open a menu', () => {
    const bar = readFileSync('src/components/sidebar/WorkspaceBar.vue', 'utf8')
    expect(bar).toContain('@click="store.switchWorkspace(workspace.id)"')
    expect(bar).toContain('@contextmenu.prevent="openWorkspaceMenu(workspace.id)"')
    expect(bar).toContain('Modifier')
    expect(bar).toContain('Supprimer')
    expect(bar).not.toContain('Ouvrir «')
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
        organized: true,
      },
    ]
    store.applySnapshot(data)
    await store.dismissRecovery(true)

    expect(spawned).toEqual([])
    expect(store.visibleTabs).toHaveLength(1)
    expect(store.activeSession).toMatchObject({ status: 'restorable', name: 'Production' })

    // Recovery and a dev reload both call restoreLayout; it must be idempotent.
    await store.dismissRecovery(true)
    expect(store.visibleTabs).toHaveLength(1)
    expect(store.sessions).toHaveLength(1)

    await store.activateRestorableSession('saved-1')
    expect(spawned).toHaveLength(1)
    expect(store.activeSession).toMatchObject({ status: 'connected', id: spawned[0] })
  })
})

describe('sidebar drag and drop', () => {
  it('moves the same terminal tab through the SortableJS folder container', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const tabId = store.activeTabId
    const container = document.createElement('ul')
    container.dataset.tabContainer = 'folder'
    container.dataset.folderId = 'node-folder'
    const row = document.createElement('li')
    row.className = 'terminal-tab'
    row.dataset.tabId = tabId
    container.append(row)

    finishTabMove({ item: row, to: container } as never)

    expect(store.tree[0].children.some((child) => child.tabId === tabId)).toBe(true)
    expect(store.unfavoritedTabs.some((tab) => tab.id === tabId)).toBe(false)
  })

  it('moves an SSH-backed terminal into the same pinned tab list', async () => {
    const store = await bootedStore()
    await store.openTarget('resource', RESOURCE_A)
    const tabId = store.activeTabId

    await store.pinTab(tabId)

    expect(store.pinnedTabs.map((tab) => tab.id)).toEqual([tabId])
    expect(store.tree.flatMap((node) => node.children).some((node) => node.tabId === tabId)).toBe(
      false,
    )
  })

  it('persists the order of terminal tabs inside a folder', async () => {
    const store = await bootedStore()
    await store.createTerminal()
    const first = store.activeTabId
    await store.createTerminal()
    const second = store.activeTabId
    await store.placeTab(first, 'node-folder', null)
    await store.placeTab(second, 'node-folder', first)

    const folder = store.tree.find((node) => node.id === 'node-folder')!
    expect(folder.children.filter((node) => node.tabId).map((node) => node.tabId)).toEqual([
      second,
      first,
    ])
  })

  /**
   * `move_sidebar_node` and `favorite_move` insert into the sibling list with
   * the moved row already taken out. A drop names the row to land before, so
   * the store must resolve that anchor against the same list, without the
   * off-by-one correction the caller used to apply on top.
   */
  function flatSnapshot() {
    const data = snapshot()
    data.sidebarNodes = [
      {
        id: 'n1',
        workspaceId: WORKSPACE_A,
        parentId: null,
        kind: 'folder',
        label: 'A',
        targetId: null,
        position: 0,
      },
      {
        id: 'n2',
        workspaceId: WORKSPACE_A,
        parentId: null,
        kind: 'folder',
        label: 'B',
        targetId: null,
        position: 1,
      },
      {
        id: 'n3',
        workspaceId: WORKSPACE_A,
        parentId: null,
        kind: 'folder',
        label: 'C',
        targetId: null,
        position: 2,
      },
    ]
    data.favorites = []
    return data
  }

  it('moves a node down to the position that follows its former place', async () => {
    const store = useAppStore()
    store.applySnapshot(flatSnapshot())

    // A dropped before C: siblings without A are [B, C], so C sits at index 1.
    await store.reparentNode('n1', null, 'n3')
    expect(moves).toEqual([{ call: 'move', id: 'n1', parentId: null, position: 1 }])
  })

  it('moves a node up without shifting the anchor', async () => {
    const store = useAppStore()
    store.applySnapshot(flatSnapshot())

    await store.reparentNode('n3', null, 'n1')
    expect(moves).toEqual([{ call: 'move', id: 'n3', parentId: null, position: 0 }])
  })

  it('appends when no row follows the drop', async () => {
    const store = useAppStore()
    store.applySnapshot(flatSnapshot())

    await store.reparentNode('n1', null, null)
    expect(moves).toEqual([{ call: 'move', id: 'n1', parentId: null, position: 2 }])
  })

  it('drops a node into a folder at the end of its children', async () => {
    const store = useAppStore()
    store.applySnapshot(flatSnapshot())

    await store.reparentNode('n3', 'n1', null)
    expect(moves).toEqual([{ call: 'move', id: 'n3', parentId: 'n1', position: 0 }])
  })

  it('refuses a drop of a row onto itself', async () => {
    const store = useAppStore()
    store.applySnapshot(flatSnapshot())

    await store.reparentNode('n1', null, 'n1')
    await store.reparentNode('n1', 'n1', null)
    expect(moves).toEqual([])
  })

  it('unpins a favorite when it lands in the tree', async () => {
    const store = useAppStore()
    const data = snapshot()
    data.favorites = [
      {
        id: 'fav-a',
        workspaceId: WORKSPACE_A,
        targetKind: 'resource',
        targetId: RESOURCE_A,
        position: 0,
      },
    ]
    store.applySnapshot(data)

    await store.placeTarget(RESOURCE_A, 'node-folder', null)
    expect(moves).toEqual([
      { call: 'favorite', targetId: RESOURCE_A, pinned: false },
      { call: 'move', id: 'node-resource', parentId: 'node-folder', position: 0 },
    ])
  })

  it('houses a local terminal inside a folder instead of pinning a second row', async () => {
    const store = await bootedStore()
    const folder = store.tree.find((node) => node.kind === 'folder')
    expect(folder?.id).toBe('node-folder')
    await store.createTerminal()
    const tabId = store.activeTabId

    await store.placeTab(tabId, folder!.id, null)

    expect(store.unfavoritedTabs.map((tab) => tab.id)).not.toContain(tabId)
    expect(store.pinnedTabs).toEqual([])
    expect(store.activeTabId).toBe(tabId)
    expect(store.tree.some((node) => node.children.some((child) => child.tabId === tabId))).toBe(
      true,
    )
  })

  it('drops an SSH tab into the tree without pinning a second row', async () => {
    const store = await bootedStore()
    await store.openTarget('resource', RESOURCE_A)
    const tabId = store.activeTabId

    await store.placeTab(tabId, 'node-folder', null)

    expect(store.pinnedTabs).toEqual([])
    expect(store.unfavoritedTabs).toEqual([])
    expect(store.visibleTabs.map((tab) => tab.id)).toEqual([tabId])
    expect(store.isTargetActive(RESOURCE_A)).toBe(true)
  })

  it('reorders favorites against the list without the moved one', async () => {
    const store = useAppStore()
    const data = snapshot()
    data.resources = [
      ...data.resources,
      {
        id: 'resource-b',
        workspaceId: WORKSPACE_A,
        name: 'Staging',
        sshAlias: 'stg',
        host: null,
        port: null,
        identityId: IDENTITY_A,
      },
    ]
    data.favorites = [
      {
        id: 'f1',
        workspaceId: WORKSPACE_A,
        targetKind: 'resource',
        targetId: RESOURCE_A,
        position: 0,
      },
      {
        id: 'f2',
        workspaceId: WORKSPACE_A,
        targetKind: 'resource',
        targetId: 'resource-b',
        position: 1,
      },
    ]
    store.applySnapshot(data)

    // f1 dropped after f2 means "before nothing": last place, index 1.
    await store.pinTarget(RESOURCE_A, null)
    expect(moves).toEqual([{ call: 'moveFavorite', id: 'f1', position: 1 }])
  })

  it('pins a tree row that was never a favorite, at the head of the list', async () => {
    const store = useAppStore()
    const data = snapshot()
    data.resources = [
      ...data.resources,
      {
        id: 'resource-b',
        workspaceId: WORKSPACE_A,
        name: 'Staging',
        sshAlias: 'stg',
        host: null,
        port: null,
        identityId: IDENTITY_A,
      },
    ]
    data.sidebarNodes.push({
      id: 'node-staging',
      workspaceId: WORKSPACE_A,
      parentId: null,
      kind: 'resource',
      label: 'Staging',
      targetId: 'resource-b',
      position: 2,
    })
    data.favorites = [
      {
        id: 'f2',
        workspaceId: WORKSPACE_A,
        targetKind: 'resource',
        targetId: RESOURCE_A,
        position: 0,
      },
    ]
    store.applySnapshot(data)

    await store.pinTarget('resource-b', 'f2')
    expect(moves[0]).toEqual({ call: 'favorite', targetId: 'resource-b', pinned: true })
  })

  it('refuses to pin a local launch profile', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    await store.pinTarget(PROFILE_A, null)
    await store.placeTarget(PROFILE_A, null, null)
    expect(moves).toEqual([])
  })

  it('reorders open tabs by naming the tab to precede', async () => {
    const store = useAppStore()
    const data = snapshot()
    data.savedSessions = ['t1', 't2', 't3'].map((id) => ({
      id: `session-${id}`,
      workspaceId: WORKSPACE_A,
      targetKind: 'resource' as const,
      targetId: RESOURCE_A,
      workingDirectory: null,
    }))
    data.tabs = ['t1', 't2', 't3'].map((id, position) => ({
      id,
      workspaceId: WORKSPACE_A,
      name: id,
      root: { kind: 'pane' as const, sessionId: `session-${id}` },
      position,
      organized: false,
    }))
    store.applySnapshot(data)
    await store.dismissRecovery(true)
    expect(store.visibleTabs.map((tab) => tab.id)).toEqual(['t1', 't2', 't3'])

    await store.reorderTab('t1', null)
    expect(store.visibleTabs.map((tab) => tab.id)).toEqual(['t2', 't3', 't1'])

    await store.reorderTab('t1', 't2')
    expect(store.visibleTabs.map((tab) => tab.id)).toEqual(['t1', 't2', 't3'])

    await store.reorderTab('t3', 't2')
    expect(store.visibleTabs.map((tab) => tab.id)).toEqual(['t1', 't3', 't2'])
  })
})
