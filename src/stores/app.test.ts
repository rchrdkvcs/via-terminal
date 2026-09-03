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
    moveSidebarNode: vi.fn(async () => undefined),
    saveSidebarRootOrder: vi.fn(async () => undefined),
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

  it('extends one split group to four tabs and rejects a fifth', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    await store.createTerminal()
    await store.splitActivePane('vertical')
    const anchor = store.tabs[0].id
    for (let size = 3; size <= 4; size += 1) {
      await store.createTerminal()
      await store.linkTabs(store.activeTabId, anchor, 'right')
      expect(store.splitGroups[0].tabIds).toHaveLength(size)
    }
    await store.createTerminal()
    await store.linkTabs(store.activeTabId, anchor, 'right')

    expect(store.splitGroups[0].tabIds).toHaveLength(4)
    expect(new Set(store.tabs.map((tab) => tab.id)).size).toBe(5)
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

  it('restores the last active workspace from the saved window', () => {
    const store = useAppStore()
    const data = snapshot()
    data.workspaces.push({
      id: 'second',
      name: 'Second',
      icon: 'terminal',
      color: '#000000',
      position: 1,
      defaultProfileId: null,
    })
    data.windows.push({
      id: 'window',
      activeWorkspaceId: 'second',
      activeTabId: null,
      x: null,
      y: null,
      width: 1100,
      height: 720,
      maximized: false,
      sidebarHidden: false,
    })

    store.applySnapshot(data)

    expect(store.activeWorkspaceId).toBe('second')
  })

  it('removes a stopped pinned tab without cloning a Vue proxy', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    await store.createTerminal()
    const id = store.activeTabId
    await store.pinTab(id)
    await store.stopTab(id)

    await expect(store.closeTab(id, { force: true })).resolves.toBeUndefined()

    expect(store.tabs).toHaveLength(0)
  })

  it('projects a foldered tab exactly once inside its folder', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    await store.createTerminal()
    const tab = store.tabs[0]
    tab.organized = true
    tab.folderId = 'folder'
    store.sidebarNodes.push({
      id: 'folder',
      workspaceId: WORKSPACE,
      parentId: null,
      kind: 'folder',
      label: 'Projet',
      targetId: null,
      position: 0,
    })

    expect(store.pinnedTabs).toHaveLength(0)
    expect(store.tree[0].children.map((node) => node.tabId)).toEqual([tab.id])
  })

  it('pins a temporary tab at a precise root position next to a folder', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    await store.createTerminal()
    const pinned = store.activeTabId
    await store.pinTab(pinned)
    store.sidebarNodes.push({
      id: 'folder',
      workspaceId: WORKSPACE,
      parentId: null,
      kind: 'folder',
      label: 'Projet',
      targetId: null,
      position: 1,
    })
    await store.createTerminal()
    const temporary = store.activeTabId

    await store.placeTab(temporary, null, 'folder')

    expect(store.tabs.find((tab) => tab.id === temporary)).toMatchObject({
      organized: true,
      folderId: null,
      position: 1,
    })
    expect(store.tabs.find((tab) => tab.id === pinned)?.position).toBe(0)
  })

  it('computes deletion impact and asks before removing descendants', async () => {
    const store = useAppStore()
    store.applySnapshot(snapshot())
    store.sidebarNodes.push(
      {
        id: 'folder',
        workspaceId: WORKSPACE,
        parentId: null,
        kind: 'folder',
        label: 'Production',
        targetId: null,
        position: 0,
      },
      {
        id: 'resource-node',
        workspaceId: WORKSPACE,
        parentId: 'folder',
        kind: 'resource',
        label: 'Serveur',
        targetId: 'resource',
        position: 0,
      },
    )

    expect(store.getNodeDeletionImpact('folder')).toMatchObject({
      label: 'Production',
      descendantCount: 1,
      resourceCount: 1,
      activeTabCount: 0,
    })

    await store.requestNodeDelete('folder')
    expect(store.pendingNodeDelete?.id).toBe('folder')
    expect(store.sidebarNodes).toHaveLength(2)
  })
})
