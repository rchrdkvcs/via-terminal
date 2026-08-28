import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Favorite, SessionSummary, Settings, SidebarNode, Tab, Workspace } from '../types'
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
  const settings = ref<Settings>({ ...defaultSettings })
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
    if (workspaces.value.some((w) => w.id === id)) activeWorkspaceId.value = id
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
      const persisted = (await nativeApi.workspaces()) as Workspace[]
      if (persisted.length) {
        workspaces.value = persisted.map((workspace, position) => ({ ...workspace, position }))
        activeWorkspaceId.value = workspaces.value[0].id
      }
    } catch {
      // Keep the in-memory preview available if native startup fails.
    }
  }
  async function createTerminal(name = 'PowerShell') {
    const executable = name.toLowerCase().includes('ubuntu')
      ? 'wsl.exe'
      : name.toLowerCase().includes('cmd')
        ? 'cmd.exe'
        : 'powershell.exe'
    const spawned = nativeAvailable() ? await nativeApi.createSession(executable) : undefined
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
  async function closeTab(id: string) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index < 0) return
    const sessionId = tabs.value[index].sessionId
    tabs.value.splice(index, 1)
    if (sessionId && nativeAvailable())
      await nativeApi.closeSession(sessionId).catch(() => undefined)
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
    settings,
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
    closeTab,
  }
})
