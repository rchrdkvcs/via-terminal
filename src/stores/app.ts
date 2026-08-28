import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  AppSnapshot,
  AppNotice,
  Favorite,
  LocalProfile,
  SessionSummary,
  Settings,
  SidebarNode,
  Tab,
  Workspace,
} from '../types'
import { defaultSettings } from '../types'
import { nativeApi, nativeAvailable } from '../api'

const seedWorkspaces: Workspace[] = [
  { id: 'support', name: 'Support', icon: 'Wrench', color: '#a78bfa', position: 0 },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    icon: 'Server',
    color: '#67e8f9',
    position: 1,
    activity: true,
  },
  { id: 'personnel', name: 'Personnel', icon: 'Home', color: '#fbbf24', position: 2 },
]

export const useAppStore = defineStore('app', () => {
  const workspaces = ref<Workspace[]>(seedWorkspaces)
  const activeWorkspaceId = ref('support')
  const sidebarVisible = ref(true)
  const paletteOpen = ref(false)
  const settingsOpen = ref(false)
  const locked = ref(false)
  const notices = ref<AppNotice[]>([])
  const settings = ref<Settings>({ ...defaultSettings })
  const profiles = ref<LocalProfile[]>([])
  const persistedSnapshot = ref<AppSnapshot>()
  const favorites = ref<Favorite[]>([
    {
      id: 'fav-ps',
      name: 'PowerShell',
      icon: 'Terminal',
      kind: 'local',
      targetId: 'powershell',
      sessionId: 'welcome',
    },
    { id: 'fav-wsl', name: 'Ubuntu', icon: 'Box', kind: 'local', targetId: 'wsl' },
    { id: 'fav-prod', name: 'Production', icon: 'Server', kind: 'ssh', targetId: 'production' },
  ])
  const tree = ref<SidebarNode[]>([
    {
      id: 'local',
      name: 'Terminaux locaux',
      kind: 'folder',
      children: [
        { id: 'powershell', name: 'PowerShell', kind: 'profile', icon: 'Terminal' },
        { id: 'ubuntu', name: 'Ubuntu (WSL)', kind: 'profile', icon: 'Box' },
      ],
    },
    {
      id: 'clients',
      name: 'Clients',
      kind: 'folder',
      children: [
        {
          id: 'prod',
          name: 'Serveur de production',
          kind: 'resource',
          icon: 'Server',
          sessions: [],
        },
        { id: 'nas', name: 'NAS atelier', kind: 'resource', icon: 'HardDrive', sessions: [] },
      ],
    },
  ])
  const sessions = ref<SessionSummary[]>([
    {
      id: 'welcome',
      name: 'PowerShell',
      kind: 'local',
      status: 'connected',
      workspaceId: 'support',
    },
  ])
  const tabs = ref<Tab[]>([
    { id: 'tab-welcome', name: 'PowerShell', workspaceId: 'support', sessionId: 'welcome' },
  ])
  const activeTabId = ref('tab-welcome')

  const activeWorkspace = computed(
    () => workspaces.value.find((w) => w.id === activeWorkspaceId.value) ?? workspaces.value[0],
  )
  const visibleTabs = computed(() =>
    tabs.value.filter((tab) => tab.workspaceId === activeWorkspaceId.value),
  )
  const activeSession = computed(() =>
    sessions.value.find(
      (s) => s.id === tabs.value.find((t) => t.id === activeTabId.value)?.sessionId,
    ),
  )

  function switchWorkspace(id: string) {
    if (workspaces.value.some((w) => w.id === id)) {
      activeWorkspaceId.value = id
      if (persistedSnapshot.value) applyWorkspacePresentation(persistedSnapshot.value, id)
    }
  }
  function cycleWorkspace(direction: 1 | -1) {
    const index = workspaces.value.findIndex((w) => w.id === activeWorkspaceId.value)
    switchWorkspace(
      workspaces.value[(index + direction + workspaces.value.length) % workspaces.value.length].id,
    )
  }
  async function initialize() {
    if (!nativeAvailable()) return
    try {
      const snapshot = await nativeApi.snapshot()
      applySnapshot(snapshot)
      locked.value = await nativeApi.isLocked()
      if (workspaces.value.length) {
        activeWorkspaceId.value = workspaces.value[0].id
      }
    } catch {
      // Keep the in-memory preview available if native startup fails.
    }
  }
  function applySnapshot(snapshot: AppSnapshot) {
    persistedSnapshot.value = snapshot
    workspaces.value = [...snapshot.workspaces].sort((a, b) => a.position - b.position)
    profiles.value = snapshot.profiles
    settings.value = { ...defaultSettings, ...snapshot.settings }
    applyWorkspacePresentation(snapshot, workspaces.value[0]?.id)
  }
  function applyWorkspacePresentation(snapshot: AppSnapshot, workspaceId?: string) {
    const nodes = snapshot.sidebarNodes
      .filter((node) => node.workspaceId === workspaceId)
      .sort((a, b) => a.position - b.position)
    const byId = new Map<string, SidebarNode>()
    for (const node of nodes) {
      const target =
        snapshot.profiles.find((profile) => profile.id === node.targetId) ??
        snapshot.resources.find((resource) => resource.id === node.targetId)
      byId.set(node.id, {
        id: node.targetId ?? node.id,
        name: target?.name ?? node.label,
        kind: node.kind as SidebarNode['kind'],
        icon:
          node.kind === 'resource' ? 'Server' : node.kind === 'profile' ? 'Terminal' : undefined,
        children: node.kind === 'folder' ? [] : undefined,
      })
    }
    tree.value = []
    for (const node of nodes) {
      const mapped = byId.get(node.id)!
      const parent = node.parentId ? byId.get(node.parentId) : undefined
      if (parent?.children) parent.children.push(mapped)
      else tree.value.push(mapped)
    }
    const pinned = snapshot.favorites
      .filter((favorite) => favorite.workspaceId === workspaceId)
      .sort((a, b) => a.position - b.position)
    favorites.value = pinned.flatMap((favorite) => {
      const target =
        snapshot.profiles.find((profile) => profile.id === favorite.targetId) ??
        snapshot.resources.find((resource) => resource.id === favorite.targetId)
      return target
        ? [
            {
              id: favorite.id,
              name: target.name,
              icon: favorite.targetKind === 'resource' ? 'Server' : 'Terminal',
              kind: favorite.targetKind === 'resource' ? ('ssh' as const) : ('local' as const),
              targetId: favorite.targetId,
            },
          ]
        : []
    })
  }
  async function createTerminal(name = 'PowerShell') {
    const workspace = activeWorkspace.value
    const profile =
      profiles.value.find((item) => item.id === name || item.name === name) ??
      profiles.value.find((item) => item.id === workspace?.defaultProfileId)
    const spawned =
      nativeAvailable() && workspace && profile
        ? await nativeApi.createSession(workspace.id, profile.id)
        : undefined
    const id = spawned?.id ?? crypto.randomUUID()
    sessions.value.push({
      id,
      name,
      kind: 'local',
      status: 'connected',
      workspaceId: activeWorkspaceId.value,
    })
    const tab = {
      id: crypto.randomUUID(),
      name,
      workspaceId: activeWorkspaceId.value,
      sessionId: id,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
  }
  async function openSidebarNode(node: SidebarNode) {
    if (node.kind === 'profile') return createTerminal(node.name)
    if (node.kind !== 'resource') return
    const workspace = activeWorkspace.value
    const resource = persistedSnapshot.value?.resources.find((item) => item.id === node.id)
    const status: SessionSummary['status'] = nativeAvailable() ? 'connecting' : 'connected'
    try {
      if (nativeAvailable() && !resource?.identityId) {
        throw new Error('Cette ressource SSH ne possède aucune identité configurée.')
      }
      const spawned =
        nativeAvailable() && workspace && resource?.identityId
          ? await nativeApi.createSshSession(workspace.id, node.id, resource.identityId)
          : undefined
      const id = spawned?.id ?? crypto.randomUUID()
      const session: SessionSummary = {
        id,
        name: node.name,
        kind: 'ssh',
        status,
        workspaceId: activeWorkspaceId.value,
        resourceId: node.id,
      }
      sessions.value.push(session)
      node.sessions ??= []
      node.sessions.push(session)
      const tab: Tab = {
        id: crypto.randomUUID(),
        name: node.name,
        workspaceId: activeWorkspaceId.value,
        sessionId: id,
      }
      tabs.value.push(tab)
      activeTabId.value = tab.id
    } catch (error) {
      reportError(`Connexion à « ${node.name} » impossible`, error)
    }
  }
  function updateSessionStatus(id: string, status: SessionSummary['status'], message?: string) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session) return
    session.status = status
    session.message = message
    if (status === 'failed' || status === 'disconnected') {
      const workspace = workspaces.value.find((item) => item.id === session.workspaceId)
      if (workspace) workspace.activity = true
      notices.value.push({
        id: crypto.randomUUID(),
        kind: 'error',
        message:
          message ?? `${session.name} est ${status === 'failed' ? 'en échec' : 'déconnecté'}.`,
      })
    }
  }
  function reportError(context: string, error: unknown) {
    notices.value.push({
      id: crypto.randomUUID(),
      kind: 'error',
      message: `${context}. ${error instanceof Error ? error.message : String(error)}`,
    })
  }
  function dismissNotice(id: string) {
    notices.value = notices.value.filter((notice) => notice.id !== id)
  }
  function moveSidebarNode(id: string, direction: -1 | 1) {
    const moveIn = (nodes: SidebarNode[]): boolean => {
      const index = nodes.findIndex((node) => node.id === id)
      if (index >= 0) {
        const target = index + direction
        if (target >= 0 && target < nodes.length) {
          ;[nodes[index], nodes[target]] = [nodes[target], nodes[index]]
        }
        return true
      }
      return nodes.some((node) => (node.children ? moveIn(node.children) : false))
    }
    moveIn(tree.value)
  }
  async function createWorkspace() {
    const name = window.prompt('Nom du workspace')?.trim()
    if (!name) return
    if (nativeAvailable()) {
      const workspace = await nativeApi.createWorkspace(name)
      applySnapshot(await nativeApi.snapshot())
      switchWorkspace(workspace.id)
    } else {
      const workspace: Workspace = {
        id: crypto.randomUUID(),
        name,
        icon: 'Terminal',
        color: '#7c6ef6',
        position: workspaces.value.length,
      }
      workspaces.value.push(workspace)
      switchWorkspace(workspace.id)
    }
  }
  async function splitActiveTab(orientation: 'horizontal' | 'vertical' = 'vertical') {
    const tab = tabs.value.find((item) => item.id === activeTabId.value)
    if (!tab || tab.secondarySessionId) return
    const workspace = activeWorkspace.value
    const profile = profiles.value.find((item) => item.id === workspace?.defaultProfileId)
    const spawned =
      nativeAvailable() && workspace && profile
        ? await nativeApi.createSession(workspace.id, profile.id)
        : undefined
    const id = spawned?.id ?? crypto.randomUUID()
    sessions.value.push({
      id,
      name: profile?.name ?? 'PowerShell',
      kind: 'local',
      status: 'connected',
      workspaceId: activeWorkspaceId.value,
    })
    tab.secondarySessionId = id
    tab.split = orientation
  }
  async function lock() {
    if (nativeAvailable()) await nativeApi.lock()
    else locked.value = true
  }
  async function unlock(pin: string) {
    if (nativeAvailable()) await nativeApi.unlock(pin)
    else locked.value = false
  }
  async function configurePin(pin: string) {
    if (!/^\d{4,}$/.test(pin)) throw new Error('Le PIN doit contenir au moins 4 chiffres.')
    if (nativeAvailable()) await nativeApi.setupPin(pin)
  }
  async function closeTab(id: string) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index < 0) return
    const sessionId = tabs.value[index].sessionId
    const secondarySessionId = tabs.value[index].secondarySessionId
    const activeSessions = [sessionId, secondarySessionId]
      .map((session) => sessions.value.find((item) => item.id === session))
      .filter(
        (session) => session && !['closed', 'failed', 'disconnected'].includes(session.status),
      )
    if (activeSessions.length && !window.confirm('Fermer cet onglet et ses sessions actives ?'))
      return
    tabs.value.splice(index, 1)
    if (sessionId && nativeAvailable())
      await nativeApi.closeSession(sessionId).catch(() => undefined)
    if (secondarySessionId && nativeAvailable())
      await nativeApi.closeSession(secondarySessionId).catch(() => undefined)
    activeTabId.value = visibleTabs.value[Math.max(0, index - 1)]?.id ?? ''
  }
  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    sidebarVisible,
    paletteOpen,
    settingsOpen,
    locked,
    notices,
    settings,
    profiles,
    favorites,
    tree,
    sessions,
    tabs,
    visibleTabs,
    activeTabId,
    activeSession,
    initialize,
    switchWorkspace,
    cycleWorkspace,
    createTerminal,
    openSidebarNode,
    updateSessionStatus,
    reportError,
    dismissNotice,
    moveSidebarNode,
    createWorkspace,
    splitActiveTab,
    lock,
    unlock,
    configurePin,
    closeTab,
  }
})
