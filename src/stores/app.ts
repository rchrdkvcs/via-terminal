import { defineStore } from 'pinia'
import { computed, nextTick, ref, shallowRef } from 'vue'
import { api, describeError, isNative } from '@/ipc/client'
import { on } from '@/ipc/events'
import type {
  AppData,
  FavoriteRecord,
  Id,
  Identity,
  LocalProfile,
  PaneTree,
  Resource,
  SavedSession,
  Settings,
  SidebarNodeRecord,
  SplitDirection,
  SplitTabTree,
  Tab,
  TargetKind,
  ThemePreference,
  Workspace,
} from '@/ipc/types'
import { defaultSettings } from '@/ipc/types'
import { loadPreferences, savePreferences, type LocalPreferences } from '@/lib/preferences'
import { MONO_FONT_STACK } from '@/lib/shells'
import {
  loadSidebarNavigation,
  saveSidebarNavigation,
  type SidebarNavigationState,
} from '@/lib/sidebar-state'
import { terminals } from '@/terminal/registry'

export type SessionKind = 'local' | 'ssh'
const MAIN_WINDOW_ID = '00000000-0000-0000-0000-000000000001'

export type SessionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'closed'
  /** Restored from a saved layout; no process has been started for it yet. */
  | 'restorable'

export interface SessionSummary {
  id: Id
  workspaceId: Id
  name: string
  kind: SessionKind
  targetKind: TargetKind
  targetId: Id
  status: SessionStatus
  detail: string
  message?: string
  contextTitle?: string
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export type PaneNode =
  | { kind: 'pane'; id: string; sessionId: Id }
  | {
      kind: 'split'
      id: string
      direction: SplitDirection
      ratio: number
      first: PaneNode
      second: PaneNode
    }

export interface RuntimeTab {
  id: Id
  workspaceId: Id
  name: string
  root: PaneNode
  activePaneId: string
  position: number
  /**
   * Pinned tabs sit above the divider. Saved SSH targets live in the tree as
   * unique tabs; only extra instances (Ctrl/Shift click) join the open list.
   */
  organized: boolean
  /** Local terminals dropped into a folder live here; SSH unique tabs use a sidebar node. */
  folderId: Id | null
}

export type RuntimeSplitTree =
  | { kind: 'tab'; tabId: Id }
  | {
      kind: 'split'
      id: string
      direction: SplitDirection
      ratio: number
      first: RuntimeSplitTree
      second: RuntimeSplitTree
    }

export interface RuntimeSplitGroup {
  id: Id
  workspaceId: Id
  windowId: Id
  tabIds: Id[]
  root: RuntimeSplitTree
}

export interface TreeNode {
  id: Id
  parentId: Id | null
  kind: SidebarNodeRecord['kind']
  label: string
  targetId: Id | null
  depth: number
  children: TreeNode[]
  /** Live sessions currently backed by this node's target. */
  sessionIds: Id[]
  /** Present when this row is a tab housed in a folder rather than a sidebar node. */
  tabId?: Id
}

export interface Notice {
  id: string
  kind: 'info' | 'error' | 'success'
  message: string
  action?: { label: string; run: () => void }
}

const identifier = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const emptyData = (): AppData => ({
  workspaces: [],
  profiles: [],
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
})

export const useAppStore = defineStore('app', () => {
  /* --------------------------------------------------------- persisted data */
  const workspaces = ref<Workspace[]>([])
  const profiles = ref<LocalProfile[]>([])
  const resources = ref<Resource[]>([])
  const identities = ref<Identity[]>([])
  const sidebarNodes = ref<SidebarNodeRecord[]>([])
  const favoriteRecords = ref<FavoriteRecord[]>([])
  const savedSessions = ref<SavedSession[]>([])
  const savedTabs = ref<Tab[]>([])
  const settings = ref<Settings>({ ...defaultSettings })
  const preferences = ref<LocalPreferences>(loadPreferences())
  const sidebarNavigation = ref<SidebarNavigationState>(loadSidebarNavigation())
  const detectedShells = shallowRef<string[]>([])

  /* -------------------------------------------------------------- runtime */
  const sessions = ref<SessionSummary[]>([])
  const tabs = ref<RuntimeTab[]>([])
  const splitGroups = ref<RuntimeSplitGroup[]>([])
  const activeWorkspaceId = ref<Id>('')
  /** Remembered per workspace so switching back restores the same tab. */
  const activeTabPerWorkspace = ref<Record<Id, Id | undefined>>({})
  const notices = ref<Notice[]>([])
  const renamingNodeId = ref<Id | null>(null)
  const pendingWorkspaceDelete = ref<Id | null>(null)
  const isSwitchingWorkspace = ref(false)
  const workspaceSwitchDirection = ref<-1 | 0 | 1>(0)
  let workspaceTransitionTimer: ReturnType<typeof setTimeout> | undefined
  let lastWorkspaceWheelChange = 0

  /* ------------------------------------------------------------ shell state */
  const ready = ref(false)
  /** The user's own choice: the sidebar stays in the layout and pushes it. */
  const sidebarPinned = ref(true)
  /**
   * A temporary reveal driven by the 8 px edge strip. It floats over the
   * terminal instead of pushing it, so a peek never triggers a reflow and an
   * xterm refit.
   */
  const sidebarPeek = ref(false)
  const sidebarOpen = computed(() => sidebarPinned.value || sidebarPeek.value)
  const route = ref<'workspace' | 'settings'>('workspace')
  const settingsSection = ref('general')
  const paletteOpen = ref(false)
  const searchOpen = ref(false)
  const locked = ref(false)
  const pinConfigured = ref(false)
  const recoveryAvailable = ref(false)
  const windowId = ref<Id>(MAIN_WINDOW_ID)

  /* ----------------------------------------------------------- derived data */
  const activeWorkspace = computed(
    () => workspaces.value.find((item) => item.id === activeWorkspaceId.value) ?? null,
  )

  const workspaceProfiles = computed(() =>
    profiles.value.filter((item) => item.workspaceId === activeWorkspaceId.value),
  )
  const workspaceResources = computed(() =>
    resources.value.filter((item) => item.workspaceId === activeWorkspaceId.value),
  )
  const workspaceIdentities = computed(() =>
    identities.value.filter((item) => item.workspaceId === activeWorkspaceId.value),
  )

  function targetName(kind: TargetKind, id: Id): string | null {
    const record =
      kind === 'profile'
        ? profiles.value.find((item) => item.id === id)
        : resources.value.find((item) => item.id === id)
    return record?.name ?? null
  }

  const sessionsByTarget = computed(() => {
    const map = new Map<Id, Id[]>()
    for (const session of sessions.value) {
      if (session.status === 'closed') continue
      const current = map.get(session.targetId)
      if (current) current.push(session.id)
      else map.set(session.targetId, [session.id])
    }
    return map
  })

  const tree = computed<TreeNode[]>(() => {
    const openTabByTarget = new Map<Id, RuntimeTab>()
    for (const tab of [...tabs.value].sort((a, b) => a.position - b.position)) {
      if (tab.workspaceId !== activeWorkspaceId.value) continue
      const sessionId = paneSessionIds(tab.root)[0]
      const targetId = sessions.value.find((session) => session.id === sessionId)?.targetId
      if (targetId && !openTabByTarget.has(targetId)) openTabByTarget.set(targetId, tab)
    }
    const favoriteTargetIds = new Set(
      favoriteRecords.value
        .filter((item) => item.workspaceId === activeWorkspaceId.value)
        .filter((item) => item.targetKind !== 'profile')
        .map((item) => item.targetId),
    )
    const records = sidebarNodes.value
      .filter((node) => node.workspaceId === activeWorkspaceId.value)
      .filter((node) => node.kind === 'folder')
      .filter((node) => !node.targetId || !favoriteTargetIds.has(node.targetId))
      .filter((node) => {
        const tab = node.targetId ? openTabByTarget.get(node.targetId) : undefined
        return !tab?.organized && !tab?.folderId
      })
      .sort((a, b) => a.position - b.position)

    const byId = new Map<Id, TreeNode>()
    for (const record of records) {
      const tab = record.targetId ? openTabByTarget.get(record.targetId) : undefined
      byId.set(record.id, {
        id: record.id,
        parentId: record.parentId,
        kind: record.kind,
        label:
          tab?.name ||
          (record.targetId && targetName(recordTargetKind(record), record.targetId)) ||
          record.label,
        targetId: record.targetId,
        depth: 0,
        children: [],
        sessionIds: record.targetId ? (sessionsByTarget.value.get(record.targetId) ?? []) : [],
        tabId: tab?.id,
      })
    }

    const roots: TreeNode[] = []
    for (const record of records) {
      const node = byId.get(record.id)!
      const parent = record.parentId ? byId.get(record.parentId) : undefined
      if (parent) parent.children.push(node)
      else roots.push(node)
    }

    const assignDepth = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        node.depth = depth
        assignDepth(node.children, depth + 1)
        if (node.kind === 'folder') {
          node.sessionIds = [...new Set(node.children.flatMap((child) => child.sessionIds))]
        }
      }
    }
    assignDepth(roots, 0)

    const findNode = (nodes: TreeNode[], id: Id): TreeNode | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node
        const nested = findNode(node.children, id)
        if (nested) return nested
      }
    }
    for (const tab of [...tabs.value].sort((a, b) => a.position - b.position)) {
      if (tab.workspaceId !== activeWorkspaceId.value || !tab.folderId) continue
      const folder = findNode(roots, tab.folderId)
      if (!folder || folder.kind !== 'folder') continue
      const sessionIds = paneSessionIds(tab.root)
      const session = sessions.value.find((item) => item.id === sessionIds[0])
      folder.children.push({
        id: tab.id,
        parentId: folder.id,
        kind: session?.targetKind === 'resource' ? 'resource' : 'profile',
        label: tab.name,
        targetId: session?.targetId ?? null,
        depth: folder.depth + 1,
        children: [],
        sessionIds,
        tabId: tab.id,
      })
      folder.sessionIds = [...new Set([...folder.sessionIds, ...sessionIds])]
    }
    return roots
  })

  function recordTargetKind(record: SidebarNodeRecord): TargetKind {
    return record.kind === 'resource' ? 'resource' : 'profile'
  }

  /**
   * A favorite is shown as a pinned row above the tree rather than as a
   * separate grid, so the sidebar keeps a single column of rows.
   */
  const favorites = computed<TreeNode[]>(() =>
    favoriteRecords.value
      .filter((item) => item.workspaceId === activeWorkspaceId.value)
      .filter((item) => item.targetKind !== 'profile')
      .sort((a, b) => a.position - b.position)
      .flatMap((favorite) => {
        const name = targetName(favorite.targetKind, favorite.targetId)
        if (!name) return []
        return [
          {
            id: favorite.id,
            parentId: null,
            kind: favorite.targetKind,
            label: name,
            targetId: favorite.targetId,
            depth: 0,
            children: [],
            sessionIds: sessionsByTarget.value.get(favorite.targetId) ?? [],
          },
        ]
      }),
  )

  const visibleTabs = computed(() =>
    tabs.value
      .filter((tab) => tab.workspaceId === activeWorkspaceId.value)
      .sort((a, b) => a.position - b.position),
  )

  function primaryTargetId(tab: RuntimeTab): Id | null {
    const sessionId = paneSessionIds(tab.root)[0]
    if (!sessionId) return null
    return sessions.value.find((item) => item.id === sessionId)?.targetId ?? null
  }

  /** One live tab per saved tree target — the tree row is that unique instance. */
  function uniqueTabForTarget(targetId: Id | null | undefined): RuntimeTab | undefined {
    if (!targetId) return undefined
    return visibleTabs.value.find((tab) => primaryTargetId(tab) === targetId)
  }

  const unfavoritedTabs = computed(() =>
    visibleTabs.value.filter((tab) => !tab.organized && !tab.folderId),
  )
  /** Pinned tabs sit above the divider, like Zen; they are the same tabs, not copies. */
  const pinnedTabs = computed(() =>
    visibleTabs.value.filter((tab) => tab.organized && !tab.folderId),
  )

  const activeTabId = computed(() => activeTabPerWorkspace.value[activeWorkspaceId.value] ?? '')
  const activeTab = computed(
    () => visibleTabs.value.find((tab) => tab.id === activeTabId.value) ?? null,
  )
  const activeSplitGroup = computed(() =>
    splitGroups.value.find((group) => group.tabIds.includes(activeTabId.value)),
  )

  const sessionById = computed(() => {
    const map = new Map<Id, SessionSummary>()
    for (const session of sessions.value) map.set(session.id, session)
    return map
  })

  const activePaneSessionId = computed(() => {
    const tab = activeTab.value
    if (!tab) return null
    const pane = findPane(tab.root, tab.activePaneId) ?? firstPane(tab.root)
    return pane?.sessionId ?? null
  })

  const activeSession = computed(() =>
    activePaneSessionId.value ? (sessionById.value.get(activePaneSessionId.value) ?? null) : null,
  )

  /** The sidebar highlights only the target of the tab the user is looking at. */
  function isTargetActive(targetId: Id | null | undefined) {
    return Boolean(targetId) && activeSession.value?.targetId === targetId
  }

  const appearance = computed<'dark' | 'light'>(() => {
    if (settings.value.theme === 'system')
      return preferences.value.systemPrefersDark ? 'dark' : 'light'
    return settings.value.theme === 'light' ? 'light' : 'dark'
  })

  /* ------------------------------------------------------- pane tree helpers */
  function firstPane(node: PaneNode): Extract<PaneNode, { kind: 'pane' }> | null {
    if (node.kind === 'pane') return node
    return firstPane(node.first) ?? firstPane(node.second)
  }

  function findPane(node: PaneNode, id: string): Extract<PaneNode, { kind: 'pane' }> | null {
    if (node.kind === 'pane') return node.id === id ? node : null
    return findPane(node.first, id) ?? findPane(node.second, id)
  }

  function paneSessionIds(node: PaneNode): Id[] {
    return node.kind === 'pane'
      ? [node.sessionId]
      : [...paneSessionIds(node.first), ...paneSessionIds(node.second)]
  }

  /** Removing a leaf collapses its split into the surviving sibling. */
  function removePane(node: PaneNode, id: string): PaneNode | null {
    if (node.kind === 'pane') return node.id === id ? null : node
    const first = removePane(node.first, id)
    const second = removePane(node.second, id)
    if (!first) return second
    if (!second) return first
    return { ...node, first, second }
  }

  function toWire(node: PaneNode): PaneTree {
    return node.kind === 'pane'
      ? { kind: 'pane', sessionId: node.sessionId }
      : {
          kind: 'split',
          direction: node.direction,
          ratio: node.ratio,
          first: toWire(node.first),
          second: toWire(node.second),
        }
  }

  function splitToWire(node: RuntimeSplitTree): SplitTabTree {
    return node.kind === 'tab'
      ? { kind: 'tab', tabId: node.tabId }
      : {
          kind: 'split',
          direction: node.direction,
          ratio: node.ratio,
          first: splitToWire(node.first),
          second: splitToWire(node.second),
        }
  }

  function splitFromWire(node: SplitTabTree): RuntimeSplitTree {
    return node.kind === 'tab'
      ? { kind: 'tab', tabId: node.tabId }
      : {
          kind: 'split',
          id: identifier(),
          direction: node.direction,
          ratio: node.ratio,
          first: splitFromWire(node.first),
          second: splitFromWire(node.second),
        }
  }

  /* -------------------------------------------------------------- notices */
  function notify(kind: Notice['kind'], message: string, action?: Notice['action']) {
    const notice: Notice = { id: identifier(), kind, message, action }
    notices.value = [...notices.value.slice(-4), notice]
    return notice
  }

  function report(context: string, error: unknown) {
    return notify('error', `${context} : ${describeError(error)}`)
  }

  function dismissNotice(id: string) {
    notices.value = notices.value.filter((notice) => notice.id !== id)
  }

  /* ------------------------------------------------------------ persistence */
  let layoutTimer: ReturnType<typeof setTimeout> | undefined

  /** TECHNICAL.md: layout writes are debounced and committed atomically. */
  function scheduleLayoutSave(tabId: Id) {
    if (!isNative()) return
    if (!tabs.value.find((item) => item.id === tabId && item.organized)) return
    if (layoutTimer) clearTimeout(layoutTimer)
    layoutTimer = setTimeout(() => void persistTab(tabId), 400)
  }

  async function persistTab(tabId: Id) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab || !tab.organized) return
    const descriptors: SavedSession[] = paneSessionIds(tab.root).flatMap((sessionId) => {
      const session = sessionById.value.get(sessionId)
      if (!session) return []
      return [
        {
          id: session.id,
          workspaceId: session.workspaceId,
          targetKind: session.targetKind,
          targetId: session.targetId,
          workingDirectory: null,
        },
      ]
    })
    try {
      await api.saveTab(
        {
          id: tab.id,
          workspaceId: tab.workspaceId,
          name: tab.name,
          root: toWire(tab.root),
          position: tab.position,
          organized: tab.organized,
          folderId: tab.folderId,
        },
        descriptors,
      )
    } catch (error) {
      report('Impossible d’enregistrer la disposition', error)
    }
  }

  async function persistSplitGroup(group: RuntimeSplitGroup) {
    if (!isNative()) return
    if (!group.tabIds.every((id) => tabs.value.find((tab) => tab.id === id)?.organized)) return
    await api
      .saveSplitGroup({
        id: group.id,
        workspaceId: group.workspaceId,
        tabIds: [...group.tabIds],
        root: splitToWire(group.root),
      })
      .catch((error) => report('Impossible d’enregistrer le groupe de splits', error))
  }

  async function persistWindowState() {
    if (!isNative()) return
    try {
      await api.saveWindowState({
        id: windowId.value,
        activeWorkspaceId: activeWorkspaceId.value || null,
        activeTabId: activeTabId.value || null,
        x: null,
        y: null,
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
        maximized: false,
        sidebarHidden: !sidebarPinned.value,
      })
    } catch {
      // Window geometry is a convenience; never surface a failure for it.
    }
  }

  /* ------------------------------------------------------------ bootstrap */
  function applySnapshot(data: AppData) {
    workspaces.value = [...data.workspaces].sort((a, b) => a.position - b.position)
    const savedWindow = !ready.value
      ? (data.windows.find((window) => window.id === windowId.value) ??
        (windowId.value === MAIN_WINDOW_ID ? data.windows[data.windows.length - 1] : undefined))
      : undefined
    if (savedWindow) {
      if (
        savedWindow.activeWorkspaceId &&
        workspaces.value.some((workspace) => workspace.id === savedWindow.activeWorkspaceId)
      ) {
        activeWorkspaceId.value = savedWindow.activeWorkspaceId
        if (savedWindow.activeTabId)
          activeTabPerWorkspace.value[savedWindow.activeWorkspaceId] = savedWindow.activeTabId
      }
      sidebarPinned.value = !savedWindow.sidebarHidden
    }
    profiles.value = data.profiles
    resources.value = data.resources
    identities.value = data.identities
    sidebarNodes.value = data.sidebarNodes
    favoriteRecords.value = data.favorites
    savedSessions.value = data.savedSessions
    savedTabs.value = data.tabs
    splitGroups.value = data.splitGroups.map((group) => ({
      id: group.id,
      workspaceId: group.workspaceId,
      windowId: windowId.value,
      tabIds: [...group.tabIds],
      root: splitFromWire(group.root),
    }))
    settings.value = { ...defaultSettings, ...data.settings }
    if (!workspaces.value.some((item) => item.id === activeWorkspaceId.value))
      activeWorkspaceId.value = workspaces.value[0]?.id ?? ''
    applyPresentation()
  }

  function applyPresentation() {
    terminals.setPresentation({
      fontFamily: `${settings.value.fontFamily}, ${MONO_FONT_STACK}`,
      fontSize: settings.value.fontSize,
      cursorStyle: preferences.value.cursorStyle,
      cursorBlink: preferences.value.cursorBlink,
      screenReaderMode: preferences.value.screenReaderMode,
      scrollback: preferences.value.scrollback,
      appearance: appearance.value,
    })
  }

  async function initialize() {
    if (!isNative()) {
      applySnapshot(emptyData())
      ready.value = true
      return
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const label = getCurrentWindow().label
      if (label.startsWith('window-')) windowId.value = label.slice('window-'.length)
      const [data, isLocked, shells] = await Promise.all([
        api.snapshot(),
        api.isLocked(),
        api.detectProfiles().catch(() => [] as string[]),
      ])
      applySnapshot(data)
      locked.value = isLocked
      pinConfigured.value = isLocked
      recoveryAvailable.value = false
      detectedShells.value = shells
      restoreLayout()
      await api.finishRecovery().catch(() => undefined)
    } catch (error) {
      report('Démarrage incomplet', error)
    } finally {
      ready.value = true
    }
  }

  /**
   * PRODUCT.md: layout comes back, but no remote connection and no previous
   * command is replayed. Every restored pane starts as a `restorable`
   * placeholder the user activates explicitly.
   */
  function restoreLayout() {
    const descriptors = new Map(savedSessions.value.map((item) => [item.id, item]))
    for (const saved of savedTabs.value) {
      if (!saved.root || !saved.organized) continue
      // `initialize` and an accepted recovery can both reach this point, and a
      // dev reload runs it again; restoring a tab twice used to duplicate every
      // pane and its placeholder session.
      if (tabs.value.some((tab) => tab.id === saved.id)) continue
      const placeholders: SessionSummary[] = []
      const root = rebuildPane(saved.root, saved.workspaceId, descriptors, placeholders)
      if (!root) continue
      sessions.value.push(
        ...placeholders.filter(
          (placeholder) => !sessions.value.some((item) => item.id === placeholder.id),
        ),
      )
      const runtime: RuntimeTab = {
        id: saved.id,
        workspaceId: saved.workspaceId,
        name: saved.name,
        root,
        activePaneId: firstPane(root)?.id ?? '',
        position: saved.position,
        organized: saved.organized,
        folderId: saved.folderId ?? null,
      }
      tabs.value.push(runtime)
    }
  }

  function rebuildPane(
    node: PaneTree,
    workspaceId: Id,
    descriptors: Map<Id, SavedSession>,
    collected: SessionSummary[],
  ): PaneNode | null {
    if (node.kind === 'pane') {
      const descriptor = descriptors.get(node.sessionId)
      if (!descriptor) return null
      const name = targetName(descriptor.targetKind, descriptor.targetId)
      if (!name) return null
      collected.push({
        id: descriptor.id,
        workspaceId,
        name,
        kind: descriptor.targetKind === 'resource' ? 'ssh' : 'local',
        targetKind: descriptor.targetKind,
        targetId: descriptor.targetId,
        status: 'restorable',
        detail: describeTarget(descriptor.targetKind, descriptor.targetId),
      })
      return { kind: 'pane', id: identifier(), sessionId: descriptor.id }
    }
    const first = rebuildPane(node.first, workspaceId, descriptors, collected)
    const second = rebuildPane(node.second, workspaceId, descriptors, collected)
    if (!first) return second
    if (!second) return first
    return {
      kind: 'split',
      id: identifier(),
      direction: node.direction,
      ratio: node.ratio,
      first,
      second,
    }
  }

  async function dismissRecovery(restore: boolean) {
    recoveryAvailable.value = false
    if (restore) restoreLayout()
    if (isNative()) await api.finishRecovery().catch(() => undefined)
  }

  function describeTarget(kind: TargetKind, id: Id): string {
    if (kind === 'profile') {
      const profile = profiles.value.find((item) => item.id === id)
      return profile ? profile.executable : 'Profil local'
    }
    const resource = resources.value.find((item) => item.id === id)
    if (!resource) return 'Ressource SSH'
    const identity = identities.value.find((item) => item.id === resource.identityId)
    const destination = resource.sshAlias ?? resource.host ?? 'hôte inconnu'
    const port = resource.port && resource.port !== 22 ? `:${resource.port}` : ''
    return identity ? `${identity.username}@${destination}${port}` : `${destination}${port}`
  }

  /* -------------------------------------------------------------- workspaces */
  function switchWorkspace(id: Id) {
    if (!workspaces.value.some((item) => item.id === id)) return
    if (id === activeWorkspaceId.value) return
    const previousIndex = workspaces.value.findIndex((item) => item.id === activeWorkspaceId.value)
    const nextIndex = workspaces.value.findIndex((item) => item.id === id)
    workspaceSwitchDirection.value =
      nextIndex === previousIndex ? 0 : nextIndex > previousIndex ? 1 : -1
    isSwitchingWorkspace.value = true
    activeWorkspaceId.value = id
    const remembered = activeTabPerWorkspace.value[id]
    if (!remembered || !tabs.value.some((tab) => tab.id === remembered))
      activeTabPerWorkspace.value[id] = visibleTabs.value[0]?.id
    void persistWindowState()
    if (workspaceTransitionTimer) clearTimeout(workspaceTransitionTimer)
    workspaceTransitionTimer = setTimeout(() => {
      isSwitchingWorkspace.value = false
      workspaceSwitchDirection.value = 0
    }, 200)
  }

  function cycleWorkspace(direction: 1 | -1) {
    if (workspaces.value.length < 2) return
    const now = Date.now()
    if (now - lastWorkspaceWheelChange < 180) return
    lastWorkspaceWheelChange = now
    const index = workspaces.value.findIndex((item) => item.id === activeWorkspaceId.value)
    const next = (index + direction + workspaces.value.length) % workspaces.value.length
    switchWorkspace(workspaces.value[next].id)
  }

  function isFolderCollapsed(id: Id): boolean {
    return (sidebarNavigation.value.collapsedFolders[activeWorkspaceId.value] ?? []).includes(id)
  }

  function setFolderCollapsed(id: Id, collapsed: boolean) {
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) return
    const current = new Set(sidebarNavigation.value.collapsedFolders[workspaceId] ?? [])
    if (collapsed) current.add(id)
    else current.delete(id)
    sidebarNavigation.value = {
      ...sidebarNavigation.value,
      collapsedFolders: {
        ...sidebarNavigation.value.collapsedFolders,
        [workspaceId]: [...current],
      },
    }
    saveSidebarNavigation(sidebarNavigation.value)
  }

  function toggleFolder(id: Id) {
    setFolderCollapsed(id, !isFolderCollapsed(id))
  }

  const workspaceContentCollapsed = computed(() =>
    sidebarNavigation.value.collapsedWorkspaces.includes(activeWorkspaceId.value),
  )

  function toggleWorkspaceContent() {
    const id = activeWorkspaceId.value
    if (!id) return
    const current = new Set(sidebarNavigation.value.collapsedWorkspaces)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    sidebarNavigation.value = { ...sidebarNavigation.value, collapsedWorkspaces: [...current] }
    saveSidebarNavigation(sidebarNavigation.value)
  }

  async function createWorkspace(name: string, icon = 'terminal', defaultShell?: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const workspace = await api.createWorkspace(trimmed, icon, undefined, defaultShell)
      applySnapshot(await api.snapshot())
      switchWorkspace(workspace.id)
      notify('success', `Espace de travail « ${workspace.name} » créé.`)
    } catch (error) {
      report('Création de l’espace de travail impossible', error)
    }
  }

  async function updateWorkspace(
    id: Id,
    changes: { name?: string; icon?: string; defaultShell?: string },
  ) {
    const current = workspaces.value.find((workspace) => workspace.id === id)
    if (!current) return false
    const name = changes.name?.trim() ?? current.name
    const icon = changes.icon?.trim() ?? current.icon
    if (!name || !icon) return false
    try {
      const updated = await api.updateWorkspace(id, name, icon, changes.defaultShell)
      if (changes.defaultShell) {
        const profile = profiles.value.find((item) => item.id === updated.defaultProfileId)
        if (profile) {
          profile.executable = changes.defaultShell
          profile.name = changes.defaultShell.split(/[\\/]/).pop() || changes.defaultShell
        }
      }
      const index = workspaces.value.findIndex((workspace) => workspace.id === id)
      workspaces.value.splice(index, 1, updated)
      notify('success', `Espace de travail « ${updated.name} » mis à jour.`)
      return true
    } catch (error) {
      report('Modification de l’espace de travail impossible', error)
      return false
    }
  }

  async function reorderWorkspace(id: Id, beforeId: Id | null) {
    const moving = workspaces.value.find((workspace) => workspace.id === id)
    if (!moving || id === beforeId) return
    const ordered = workspaces.value.filter((workspace) => workspace.id !== id)
    const index = beforeId
      ? ordered.findIndex((workspace) => workspace.id === beforeId)
      : ordered.length
    if (beforeId && index < 0) return
    ordered.splice(index, 0, moving)
    workspaces.value = ordered.map((workspace, position) => ({ ...workspace, position }))
    if (!isNative()) return
    try {
      await api.moveWorkspace(id, beforeId)
    } catch (error) {
      report('Impossible de réordonner les espaces de travail', error)
      await refresh()
    }
  }

  async function deleteWorkspace(id: Id) {
    if (workspaces.value.length <= 1) {
      notify('error', 'Impossible de supprimer le dernier espace de travail.')
      pendingWorkspaceDelete.value = null
      return
    }
    const current = workspaces.value.find((workspace) => workspace.id === id)
    if (!current) return
    const fallback = workspaces.value.find((workspace) => workspace.id !== id)
    try {
      const owned = tabs.value.filter((tab) => tab.workspaceId === id)
      for (const tab of owned) await closeTab(tab.id, { force: true })
      if (activeWorkspaceId.value === id && fallback) switchWorkspace(fallback.id)
      await api.deleteWorkspace(id)
      applySnapshot(await api.snapshot())
      pendingWorkspaceDelete.value = null
      notify('success', `Espace de travail « ${current.name} » supprimé.`)
    } catch (error) {
      report('Suppression de l’espace de travail impossible', error)
    }
  }

  /* --------------------------------------------------------------- sessions */
  function registerSession(session: SessionSummary) {
    sessions.value.push(session)
  }

  function setSessionContext(sessionId: Id, title: string) {
    const session = sessions.value.find((item) => item.id === sessionId)
    if (session) session.contextTitle = title || undefined
  }

  async function startSession(
    targetKind: TargetKind,
    targetId: Id,
  ): Promise<SessionSummary | null> {
    const workspace = activeWorkspace.value
    if (!workspace) return null
    const name = targetName(targetKind, targetId)
    if (!name) return null
    const { cols, rows } = terminals.lastKnownSize

    if (targetKind === 'profile') {
      try {
        const spawned = await api.spawnSession(workspace.id, targetId, cols, rows)
        const session: SessionSummary = {
          id: spawned.id,
          workspaceId: workspace.id,
          name,
          kind: 'local',
          targetKind,
          targetId,
          status: 'connected',
          detail: describeTarget(targetKind, targetId),
        }
        registerSession(session)
        return session
      } catch (error) {
        report(`Ouverture de « ${name} » impossible`, error)
        return null
      }
    }

    const resource = resources.value.find((item) => item.id === targetId)
    if (!resource?.identityId) {
      notify('error', `« ${name} » n’a pas d’identité SSH configurée.`)
      return null
    }
    try {
      const result = await api.connectSsh(workspace.id, targetId, resource.identityId, cols, rows)
      const session: SessionSummary = {
        id: result.sessionId,
        workspaceId: workspace.id,
        name,
        kind: 'ssh',
        targetKind,
        targetId,
        status: 'connected',
        detail: `${result.resolved.user}@${result.resolved.host}:${result.resolved.port}`,
      }
      registerSession(session)
      return session
    } catch (error) {
      report(`Connexion à « ${name} » impossible`, error)
      return null
    }
  }

  /** Start the process behind a pane restored from a saved layout. */
  async function activateRestorableSession(sessionId: Id) {
    const placeholder = sessionById.value.get(sessionId)
    if (!placeholder || placeholder.status !== 'restorable') return
    const started = await startSession(placeholder.targetKind, placeholder.targetId)
    if (!started) return
    sessions.value = sessions.value.filter((item) => item.id !== sessionId)
    for (const tab of tabs.value) {
      const pane = paneSessionIds(tab.root).includes(sessionId)
      if (!pane) continue
      tab.root = rewriteSession(tab.root, sessionId, started.id)
      scheduleLayoutSave(tab.id)
    }
  }

  function rewriteSession(node: PaneNode, from: Id, to: Id): PaneNode {
    if (node.kind === 'pane') return node.sessionId === from ? { ...node, sessionId: to } : node
    return {
      ...node,
      first: rewriteSession(node.first, from, to),
      second: rewriteSession(node.second, from, to),
    }
  }

  /* ------------------------------------------------------------------ tabs */
  function nextPosition(workspaceId: Id) {
    return tabs.value.filter((tab) => tab.workspaceId === workspaceId).length
  }

  async function openTarget(
    targetKind: TargetKind,
    targetId: Id,
    options: { reuse?: boolean } = {},
  ) {
    const existing = sessionsByTarget.value.get(targetId)?.[0]
    // Clicking an already open target focuses it; a secondary action opens another.
    if (options.reuse !== false && existing) {
      focusSession(existing)
      const session = sessionById.value.get(existing)
      // The tree click is an explicit request for the CLI, including after restore.
      if (session?.status === 'restorable') await activateRestorableSession(existing)
      else if (session && (session.status === 'disconnected' || session.status === 'failed'))
        await reconnectSession(existing)
      return
    }
    const session = await startSession(targetKind, targetId)
    if (session) openSessionInTab(session, false)
  }

  function openSessionInTab(session: SessionSummary, organized = false) {
    const paneId = identifier()
    const tab: RuntimeTab = {
      id: identifier(),
      workspaceId: session.workspaceId,
      name: session.name,
      root: { kind: 'pane', id: paneId, sessionId: session.id },
      activePaneId: paneId,
      position: nextPosition(session.workspaceId),
      organized,
      folderId: null,
    }
    tabs.value.push(tab)
    activeTabPerWorkspace.value[session.workspaceId] = tab.id
    return tab
  }

  function focusSession(sessionId: Id) {
    for (const tab of tabs.value) {
      const pane = paneSessionIds(tab.root).includes(sessionId)
      if (!pane) continue
      switchWorkspace(tab.workspaceId)
      activeTabPerWorkspace.value[tab.workspaceId] = tab.id
      const leaf = findPaneBySession(tab.root, sessionId)
      if (leaf) tab.activePaneId = leaf.id
      terminals.focus(sessionId)
      return
    }
  }

  function findPaneBySession(
    node: PaneNode,
    sessionId: Id,
  ): Extract<PaneNode, { kind: 'pane' }> | null {
    if (node.kind === 'pane') return node.sessionId === sessionId ? node : null
    return findPaneBySession(node.first, sessionId) ?? findPaneBySession(node.second, sessionId)
  }

  async function selectTab(id: Id, forceStart = false) {
    const tab = tabs.value.find((item) => item.id === id)
    if (!tab) return
    activeTabPerWorkspace.value[tab.workspaceId] = id
    const pane = findPane(tab.root, tab.activePaneId) ?? firstPane(tab.root)
    if (!pane) return
    const stopped = sessionById.value.get(pane.sessionId)
    if (stopped && ['closed', 'failed', 'restorable'].includes(stopped.status)) {
      if (preferences.value.startFavoritesManually && !forceStart) return
      const replacement = await startSession(stopped.targetKind, stopped.targetId)
      if (!replacement) return
      tab.root = rewriteSession(tab.root, stopped.id, replacement.id)
      tab.activePaneId = findPaneBySession(tab.root, replacement.id)?.id ?? tab.activePaneId
      sessions.value = sessions.value.filter((session) => session.id !== stopped.id)
      scheduleLayoutSave(tab.id)
      terminals.focus(replacement.id)
      return
    }
    terminals.focus(pane.sessionId)
  }

  async function startStoppedTab(id: Id) {
    await selectTab(id, true)
  }

  function selectPane(paneId: string) {
    const tab = activeTab.value
    if (!tab) return
    tab.activePaneId = paneId
    const pane = findPane(tab.root, paneId)
    if (pane) terminals.focus(pane.sessionId)
  }

  function renameTab(id: Id, name: string) {
    const tab = tabs.value.find((item) => item.id === id)
    if (!tab || !name.trim()) return
    tab.name = name.trim()
    scheduleLayoutSave(tab.id)
  }

  /** Default target for a new terminal in the current workspace. */
  const defaultProfileId = computed(
    () => activeWorkspace.value?.defaultProfileId ?? workspaceProfiles.value[0]?.id ?? null,
  )

  async function createTerminal(profileId?: Id) {
    const id = profileId ?? defaultProfileId.value
    if (!id) {
      notify('error', 'Aucun terminal par défaut n’est configuré.')
      return
    }
    const session = await startSession('profile', id)
    if (!session) return
    openSessionInTab(session, false)
  }

  async function organizeTab(id: Id) {
    await pinTab(id)
  }

  async function splitActivePane(direction: SplitDirection) {
    const tab = activeTab.value
    if (!tab) return
    const profileId = defaultProfileId.value
    if (!profileId) return
    const session = await startSession('profile', profileId)
    if (!session) return
    const created = openSessionInTab(session, tab.organized)
    created.folderId = tab.folderId
    const group = splitGroups.value.find((item) => item.tabIds.includes(tab.id))
    if (group) {
      if (group.tabIds.length >= 4) {
        await closeTab(created.id, { force: true })
        notify('error', 'Un groupe de splits est limité à quatre terminaux.')
        return
      }
      group.tabIds.push(created.id)
      group.root = {
        kind: 'split',
        id: identifier(),
        direction,
        ratio: 0.5,
        first: group.root,
        second: { kind: 'tab', tabId: created.id },
      }
      if (created.organized) await persistTab(created.id)
      await persistSplitGroup(group)
      return
    }
    const createdGroup: RuntimeSplitGroup = {
      id: identifier(),
      workspaceId: tab.workspaceId,
      windowId: windowId.value,
      tabIds: [tab.id, created.id],
      root: {
        kind: 'split',
        id: identifier(),
        direction,
        ratio: 0.5,
        first: { kind: 'tab', tabId: tab.id },
        second: { kind: 'tab', tabId: created.id },
      },
    }
    splitGroups.value.push(createdGroup)
    if (tab.organized) await Promise.all([persistTab(tab.id), persistTab(created.id)])
    await persistSplitGroup(createdGroup)
  }

  function detachFromSplit(tabId: Id) {
    const group = splitGroups.value.find((item) => item.tabIds.includes(tabId))
    if (!group) return
    const remove = (node: RuntimeSplitTree): RuntimeSplitTree | null => {
      if (node.kind === 'tab') return node.tabId === tabId ? null : node
      const first = remove(node.first)
      const second = remove(node.second)
      if (!first) return second
      if (!second) return first
      return { ...node, first, second }
    }
    group.tabIds = group.tabIds.filter((id) => id !== tabId)
    group.root = remove(group.root) ?? { kind: 'tab', tabId: group.tabIds[0] }
    if (group.tabIds.length < 2) {
      splitGroups.value = splitGroups.value.filter((item) => item.id !== group.id)
      if (isNative()) void api.deleteSplitGroup(group.id).catch(() => undefined)
    } else void persistSplitGroup(group)
  }

  async function linkTabs(
    sourceTabId: Id,
    targetTabId: Id,
    edge: 'left' | 'right' | 'top' | 'bottom',
  ) {
    if (sourceTabId === targetTabId) return
    const source = tabs.value.find((tab) => tab.id === sourceTabId)
    const target = tabs.value.find((tab) => tab.id === targetTabId)
    if (!source || !target || source.workspaceId !== target.workspaceId) return
    const sourceGroup = splitGroups.value.find((group) => group.tabIds.includes(sourceTabId))
    const targetGroup = splitGroups.value.find((group) => group.tabIds.includes(targetTabId))
    if (sourceGroup && targetGroup) {
      notify('error', 'Deux groupes de splits existants ne peuvent pas être fusionnés.')
      return
    }
    const existingGroup = sourceGroup ?? targetGroup
    if (existingGroup) {
      if (existingGroup.tabIds.length >= 4) {
        notify('error', 'Un groupe de splits contient au maximum quatre onglets.')
        return
      }
      const anchorId = sourceGroup ? sourceTabId : targetTabId
      const newcomer = sourceGroup ? target : source
      const anchor = sourceGroup ? source : target
      newcomer.organized = anchor.organized
      newcomer.folderId = anchor.folderId
      const sourceFirst = edge === 'left' || edge === 'top'
      const replacement: RuntimeSplitTree = {
        kind: 'split',
        id: identifier(),
        direction: edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal',
        ratio: 0.5,
        first: { kind: 'tab', tabId: sourceFirst ? sourceTabId : targetTabId },
        second: { kind: 'tab', tabId: sourceFirst ? targetTabId : sourceTabId },
      }
      const replace = (node: RuntimeSplitTree): RuntimeSplitTree => {
        if (node.kind === 'tab') return node.tabId === anchorId ? replacement : node
        return { ...node, first: replace(node.first), second: replace(node.second) }
      }
      existingGroup.root = replace(existingGroup.root)
      const leaves = (node: RuntimeSplitTree): Id[] =>
        node.kind === 'tab' ? [node.tabId] : [...leaves(node.first), ...leaves(node.second)]
      existingGroup.tabIds = leaves(existingGroup.root)
      const siblings = tabs.value
        .filter(
          (tab) => tab.workspaceId === anchor.workspaceId && !existingGroup.tabIds.includes(tab.id),
        )
        .sort((a, b) => a.position - b.position)
      siblings.splice(
        Math.min(anchor.position, siblings.length),
        0,
        ...existingGroup.tabIds.map((id) => tabs.value.find((tab) => tab.id === id)!),
      )
      siblings.forEach((tab, position) => (tab.position = position))
      if (anchor.organized) {
        await persistTab(newcomer.id)
        await persistSplitGroup(existingGroup)
      }
      activeTabPerWorkspace.value[anchor.workspaceId] = sourceTabId
      return
    }
    const pinned = source.organized || target.organized
    const folderId = target.folderId
    source.organized = pinned
    target.organized = pinned
    source.folderId = folderId
    target.folderId = folderId
    const sourceFirst = edge === 'left' || edge === 'top'
    const first = sourceFirst ? source : target
    const second = sourceFirst ? target : source
    const createdGroup: RuntimeSplitGroup = {
      id: identifier(),
      workspaceId: source.workspaceId,
      windowId: windowId.value,
      tabIds: [first.id, second.id],
      root: {
        kind: 'split',
        id: identifier(),
        direction: edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal',
        ratio: 0.5,
        first: { kind: 'tab', tabId: first.id },
        second: { kind: 'tab', tabId: second.id },
      },
    }
    splitGroups.value.push(createdGroup)
    const ordered = tabs.value
      .filter(
        (item) =>
          item.workspaceId === source.workspaceId && item.id !== source.id && item.id !== target.id,
      )
      .sort((a, b) => a.position - b.position)
    ordered.splice(Math.min(source.position, target.position, ordered.length), 0, first, second)
    ordered.forEach((item, position) => (item.position = position))
    activeTabPerWorkspace.value[source.workspaceId] = source.id
    if (pinned) {
      await Promise.all([persistTab(first.id), persistTab(second.id)])
      await persistSplitGroup(createdGroup)
    }
  }

  async function transferTab(tabId: Id, workspaceId: Id, wholeGroup = false) {
    const tab = tabs.value.find((item) => item.id === tabId)
    const workspace = workspaces.value.find((item) => item.id === workspaceId)
    if (!tab || !workspace || tab.workspaceId === workspaceId) return
    const group = splitGroups.value.find((item) => item.tabIds.includes(tabId))
    const memberIds = wholeGroup && group ? group.tabIds : [tabId]
    const members = memberIds.flatMap((id) => {
      const member = tabs.value.find((item) => item.id === id)
      return member ? [member] : []
    })
    const memberSessions = members.flatMap((member) =>
      paneSessionIds(member.root).flatMap((id) => {
        const session = sessionById.value.get(id)
        return session ? [session] : []
      }),
    )
    if (memberSessions.some((session) => session.targetKind === 'resource')) {
      notify('error', 'La ressource SSH doit d’abord exister dans l’espace de destination.')
      return
    }
    const profileId = workspace.defaultProfileId
    if (!profileId) {
      notify('error', 'L’espace de destination ne possède pas de profil terminal.')
      return
    }
    if (group && !wholeGroup) detachFromSplit(tabId)
    const sourceWorkspaceId = tab.workspaceId
    for (const member of members) {
      member.workspaceId = workspaceId
      member.folderId = null
      member.position = nextPosition(workspaceId)
      for (const sessionId of paneSessionIds(member.root)) {
        const session = sessionById.value.get(sessionId)
        if (!session) continue
        session.workspaceId = workspaceId
        session.targetId = profileId
      }
      if (member.organized) await persistTab(member.id)
    }
    if (wholeGroup && group) {
      group.workspaceId = workspaceId
      await persistSplitGroup(group)
    }
    if (activeTabPerWorkspace.value[sourceWorkspaceId] === tabId)
      activeTabPerWorkspace.value[sourceWorkspaceId] = undefined
    notify('success', `Transféré vers « ${workspace.name} ».`)
  }

  function setGroupSplitRatio(splitId: string, ratio: number) {
    const group = activeSplitGroup.value
    if (!group) return
    const apply = (node: RuntimeSplitTree): RuntimeSplitTree => {
      if (node.kind === 'tab') return node
      if (node.id === splitId) return { ...node, ratio: Math.min(0.85, Math.max(0.15, ratio)) }
      return { ...node, first: apply(node.first), second: apply(node.second) }
    }
    group.root = apply(group.root)
    void persistSplitGroup(group)
  }

  function setSplitRatio(splitId: string, ratio: number) {
    const tab = activeTab.value
    if (!tab) return
    const clamped = Math.min(Math.max(ratio, 0.15), 0.85)
    const apply = (node: PaneNode): PaneNode => {
      if (node.kind === 'pane') return node
      if (node.id === splitId) return { ...node, ratio: clamped }
      return { ...node, first: apply(node.first), second: apply(node.second) }
    }
    tab.root = apply(tab.root)
    scheduleLayoutSave(tab.id)
  }

  async function closePane(paneId: string) {
    const tab = activeTab.value
    if (!tab) return
    const pane = findPane(tab.root, paneId)
    if (!pane) return
    const remaining = removePane(tab.root, paneId)
    await terminateSession(pane.sessionId)
    if (!remaining) {
      await closeTab(tab.id, { force: true })
      return
    }
    tab.root = remaining
    tab.activePaneId = firstPane(remaining)?.id ?? ''
    scheduleLayoutSave(tab.id)
  }

  function hasLiveSessions(tab: RuntimeTab) {
    return paneSessionIds(tab.root).some((id) => {
      const session = sessionById.value.get(id)
      return session ? !['closed', 'failed', 'restorable'].includes(session.status) : false
    })
  }

  async function stopTab(id: Id) {
    const tab = tabs.value.find((item) => item.id === id)
    if (!tab) return
    for (const sessionId of paneSessionIds(tab.root)) {
      terminals.release(sessionId)
      const session = sessionById.value.get(sessionId)
      if (!session || ['closed', 'failed', 'restorable'].includes(session.status)) continue
      if (isNative()) await api.closeSession(sessionId).catch(() => undefined)
      session.status = 'closed'
      session.message = 'Processus arrêté.'
    }
  }

  async function closeTab(id: Id, options: { force?: boolean } = {}) {
    const index = tabs.value.findIndex((item) => item.id === id)
    if (index < 0) return
    const tab = tabs.value[index]
    if (!options.force && preferences.value.confirmOnClose && hasLiveSessions(tab)) {
      pendingTabClose.value = tab.id
      return
    }
    pendingTabClose.value = null
    const workspaceId = tab.workspaceId
    const undoTab = clonePlain(tab)
    const undoSessions = paneSessionIds(tab.root).flatMap((sessionId) => {
      const session = sessionById.value.get(sessionId)
      return session ? [clonePlain(session)] : []
    })
    const canUndo = tab.organized && !hasLiveSessions(tab)
    detachFromSplit(id)
    const siblings = visibleTabs.value.filter((item) => item.id !== id)
    for (const sessionId of paneSessionIds(tab.root)) await terminateSession(sessionId)
    tabs.value.splice(index, 1)
    activeTabPerWorkspace.value[workspaceId] = siblings[0]?.id
    if (isNative()) await api.deleteTab(id).catch(() => undefined)
    if (canUndo)
      notify('info', `« ${tab.name} » supprimé.`, {
        label: 'Annuler',
        run: () => {
          if (tabs.value.some((item) => item.id === undoTab.id)) return
          tabs.value.push(undoTab)
          sessions.value.push(
            ...undoSessions.filter(
              (session) => !sessions.value.some((current) => current.id === session.id),
            ),
          )
          void persistTab(undoTab.id)
        },
      })
  }

  const pendingTabClose = ref<Id | null>(null)

  async function terminateSession(sessionId: Id) {
    terminals.release(sessionId)
    const session = sessionById.value.get(sessionId)
    if (session && session.status !== 'restorable' && isNative())
      await api.closeSession(sessionId).catch(() => undefined)
    sessions.value = sessions.value.filter((item) => item.id !== sessionId)
  }

  /* ----------------------------------------------------------- ssh lifecycle */
  function applySshState(payload: {
    sessionId: Id
    status: SessionStatus
    attempt: number
    replacementSessionId: Id | null
  }) {
    const session = sessions.value.find((item) => item.id === payload.sessionId)
    if (!session) return

    if (payload.replacementSessionId) {
      // The retry succeeded with a new PTY; keep the pane and its scrollback.
      const previous = session.id
      const next = payload.replacementSessionId
      session.id = next
      session.status = 'connected'
      session.message = undefined
      terminals.rebind(previous, next)
      for (const tab of tabs.value) {
        if (!paneSessionIds(tab.root).includes(previous)) continue
        tab.root = rewriteSession(tab.root, previous, next)
        scheduleLayoutSave(tab.id)
      }
      notify('success', `« ${session.name} » est reconnecté.`)
      return
    }

    session.status = payload.status
    if (payload.status === 'reconnecting') {
      session.message = `Reconnexion, tentative ${payload.attempt}…`
    } else if (payload.status === 'disconnected') {
      session.message = 'Connexion interrompue.'
    } else if (payload.status === 'failed') {
      session.message = 'Reconnexion automatique abandonnée.'
      notify('error', `« ${session.name} » ne répond plus. Reconnectez manuellement.`)
    } else {
      session.message = undefined
    }
  }

  /** Manual reconnection after the bounded automatic retries gave up. */
  async function reconnectSession(sessionId: Id) {
    const session = sessionById.value.get(sessionId)
    if (!session || session.kind !== 'ssh') return
    const resource = resources.value.find((item) => item.id === session.targetId)
    if (!resource?.identityId) return
    const { cols, rows } = terminals.lastKnownSize
    try {
      const result = await api.connectSsh(
        session.workspaceId,
        resource.id,
        resource.identityId,
        cols,
        rows,
      )
      const previous = session.id
      session.id = result.sessionId
      session.status = 'connected'
      session.message = undefined
      terminals.rebind(previous, result.sessionId)
      for (const tab of tabs.value) {
        if (!paneSessionIds(tab.root).includes(previous)) continue
        tab.root = rewriteSession(tab.root, previous, result.sessionId)
        scheduleLayoutSave(tab.id)
      }
    } catch (error) {
      report(`Reconnexion à « ${session.name} » impossible`, error)
    }
  }

  /* --------------------------------------------------------------- settings */
  let settingsTimer: ReturnType<typeof setTimeout> | undefined

  function updateSettings(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch }
    applyPresentation()
    if (!isNative()) return
    if (settingsTimer) clearTimeout(settingsTimer)
    settingsTimer = setTimeout(() => {
      void api
        .updateSettings({ ...settings.value })
        .then(async () => {
          if (patch.defaultShell) await refresh()
        })
        .catch((error) => {
          report('Réglages non enregistrés', error)
        })
    }, 300)
  }

  function updatePreferences(patch: Partial<LocalPreferences>) {
    preferences.value = { ...preferences.value, ...patch }
    savePreferences(preferences.value)
    applyPresentation()
  }

  function setTheme(theme: ThemePreference) {
    updateSettings({ theme })
  }

  /* ------------------------------------------------------------------ lock */
  async function lock() {
    if (isNative()) await api.lock().catch((error) => report('Verrouillage impossible', error))
    else locked.value = true
  }

  async function unlock(pin: string) {
    if (!isNative()) {
      locked.value = false
      return
    }
    await api.unlock(pin || null)
  }

  async function configurePin(pin: string) {
    if (!/^\d{4,}$/.test(pin)) throw new Error('Le PIN doit contenir au moins 4 chiffres.')
    await api.configurePin(pin)
    pinConfigured.value = true
  }

  /* ----------------------------------------------------------- organization */
  async function refresh() {
    if (!isNative()) return
    applySnapshot(await api.snapshot())
  }

  async function createFolder(label: string, _parentId: Id | null = null) {
    if (!activeWorkspaceId.value || !label.trim()) return
    try {
      const folder = await api.createSidebarNode(
        activeWorkspaceId.value,
        'folder',
        label.trim(),
        null,
      )
      await refresh()
      await nextTick()
      renamingNodeId.value = folder.id
      return folder
    } catch (error) {
      report('Création du dossier impossible', error)
    }
  }

  async function createFolderAfter(afterId: Id) {
    const after = sidebarNodes.value.find((node) => node.id === afterId && node.kind === 'folder')
    if (!after) return
    const folder = await createFolder('Nouveau dossier')
    if (!folder) return
    try {
      await api.moveSidebarNode(folder.id, null, after.position + 1)
      await refresh()
      renamingNodeId.value = folder.id
    } catch (error) {
      report('Positionnement du dossier impossible', error)
    }
  }

  async function createLocalProfile(input: {
    name: string
    executable: string
    args: string[]
    workingDirectory: string | null
    parentId: Id | null
  }) {
    if (!activeWorkspaceId.value) return
    try {
      const profile = await api.createProfile(
        activeWorkspaceId.value,
        input.name.trim(),
        input.executable.trim(),
        input.args,
        input.workingDirectory,
      )
      await api.createSidebarNode(
        activeWorkspaceId.value,
        'profile',
        profile.name,
        input.parentId,
        profile.id,
      )
      await refresh()
      notify('success', `Profil « ${profile.name} » ajouté.`)
    } catch (error) {
      report('Création du profil impossible', error)
    }
  }

  async function createSshResource(input: {
    name: string
    host: string | null
    sshAlias: string | null
    port: number | null
    identityName: string
    username: string
    identityFile: string | null
    parentId: Id | null
  }) {
    if (!activeWorkspaceId.value) return
    try {
      const identity = await api.createIdentity(
        activeWorkspaceId.value,
        input.identityName.trim() || input.username.trim(),
        input.username.trim(),
        input.identityFile,
      )
      const resource = await api.createResource(
        activeWorkspaceId.value,
        input.name.trim(),
        input.host,
        input.sshAlias,
        input.port,
        identity.id,
      )
      await api.createSidebarNode(
        activeWorkspaceId.value,
        'resource',
        resource.name,
        input.parentId,
        resource.id,
      )
      await refresh()
      notify('success', `Ressource « ${resource.name} » ajoutée.`)
    } catch (error) {
      report('Création de la ressource impossible', error)
    }
  }

  /**
   * Deleting a profile or a resource goes through its sidebar node, because the
   * Rust side cascades from there to favorites, saved sessions and tabs.
   */
  function nodeIdForTarget(targetId: Id): Id | null {
    return sidebarNodes.value.find((node) => node.targetId === targetId)?.id ?? null
  }

  /** Section-scoped reset, so one page never silently clears another. */
  function restoreDefaults(section: string) {
    if (section === 'general') {
      updateSettings({ ...defaultSettings })
      updatePreferences({ sidebarRevealDelay: 50, sidebarHideDelay: 300, confirmOnClose: true })
    } else if (section === 'appearance') {
      updateSettings({ theme: defaultSettings.theme })
    } else if (section === 'terminal') {
      updateSettings({
        fontFamily: defaultSettings.fontFamily,
        fontSize: defaultSettings.fontSize,
        defaultShell: detectedShells.value[0] ?? defaultSettings.defaultShell,
      })
      updatePreferences({
        cursorStyle: 'bar',
        cursorBlink: true,
        scrollback: 10_000,
        screenReaderMode: false,
      })
    } else {
      notify('info', 'Cette section n’a pas de valeurs par défaut à rétablir.')
      return
    }
    notify('success', 'Valeurs par défaut rétablies.')
  }

  async function renameNode(id: Id, label: string) {
    if (!label.trim()) return
    try {
      await api.renameSidebarNode(id, label.trim())
      await refresh()
    } catch (error) {
      report('Renommage impossible', error)
    }
  }

  async function deleteNode(id: Id) {
    try {
      const removed = new Set<Id>([id])
      let changed = true
      while (changed) {
        changed = false
        for (const node of sidebarNodes.value) {
          if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) {
            removed.add(node.id)
            changed = true
          }
        }
      }
      const removedTargets = new Set(
        sidebarNodes.value
          .filter((node) => removed.has(node.id) && node.targetId)
          .map((node) => node.targetId!),
      )
      const affectedTabs = tabs.value.filter((tab) =>
        paneSessionIds(tab.root).some((sessionId) => {
          const session = sessions.value.find((item) => item.id === sessionId)
          return Boolean(session && removedTargets.has(session.targetId))
        }),
      )
      const deletedFolder = sidebarNodes.value.find(
        (node) => node.id === id && node.kind === 'folder',
      )
      const folderTabs = tabs.value
        .filter((tab) => tab.folderId === id)
        .sort((a, b) => a.position - b.position)
      folderTabs.forEach((tab, index) => {
        tab.folderId = null
        tab.organized = true
        tab.position = (deletedFolder?.position ?? tab.position) + index
      })
      for (const tab of tabs.value) {
        if (tab.folderId && removed.has(tab.folderId)) tab.folderId = null
      }
      await api.deleteSidebarNode(id)
      await Promise.all(folderTabs.map((tab) => persistTab(tab.id)))
      for (const tab of affectedTabs) await closeTab(tab.id, { force: true })
      await refresh()
    } catch (error) {
      report('Suppression impossible', error)
    }
  }

  /** Keyboard reordering: Alt+Up / Alt+Down inside the tree. */
  async function moveNode(id: Id, direction: -1 | 1) {
    const record = sidebarNodes.value.find((item) => item.id === id)
    if (!record) return
    const siblings = sidebarNodes.value
      .filter(
        (item) => item.workspaceId === record.workspaceId && item.parentId === record.parentId,
      )
      .sort((a, b) => a.position - b.position)
    const index = siblings.findIndex((item) => item.id === id)
    const target = index + direction
    if (target < 0 || target >= siblings.length) return
    try {
      await api.moveSidebarNode(id, record.parentId, target)
      await refresh()
    } catch (error) {
      report('Déplacement impossible', error)
    }
  }

  /**
   * Drop targets name the row the dragged item must land before, never a raw
   * index: the visible rows hide favourites and collapsed folders, so an index
   * read from the screen does not match the stored positions.
   */
  function nodePosition(
    workspaceId: Id,
    parentId: Id | null,
    beforeId: Id | null,
    movingId: Id | null,
  ) {
    const siblings = sidebarNodes.value
      .filter(
        (item) =>
          item.workspaceId === workspaceId && item.parentId === parentId && item.id !== movingId,
      )
      .sort((a, b) => a.position - b.position)
    const index = beforeId ? siblings.findIndex((item) => item.id === beforeId) : -1
    return index >= 0 ? index : siblings.length
  }

  async function reparentNode(id: Id, parentId: Id | null, beforeId: Id | null) {
    const record = sidebarNodes.value.find((item) => item.id === id)
    if (!record || id === parentId || id === beforeId || (record.kind === 'folder' && parentId))
      return
    try {
      await api.moveSidebarNode(
        id,
        parentId,
        nodePosition(record.workspaceId, parentId, beforeId, id),
      )
      if (!parentId) {
        const roots = [
          ...tabs.value
            .filter(
              (tab) => tab.workspaceId === record.workspaceId && tab.organized && !tab.folderId,
            )
            .map((tab) => ({ id: tab.id, position: tab.position })),
          ...sidebarNodes.value
            .filter(
              (node) =>
                node.workspaceId === record.workspaceId &&
                node.kind === 'folder' &&
                !node.parentId &&
                node.id !== id,
            )
            .map((node) => ({ id: node.id, position: node.position })),
        ].sort((a, b) => a.position - b.position)
        const index = beforeId ? roots.findIndex((item) => item.id === beforeId) : -1
        roots.splice(index >= 0 ? index : roots.length, 0, { id, position: 0 })
        if (isNative())
          await api.saveSidebarRootOrder(
            record.workspaceId,
            roots.map((item) => item.id),
          )
      }
      await refresh()
    } catch (error) {
      report('Déplacement impossible', error)
    }
  }

  async function placeTarget(targetId: Id, parentId: Id | null, beforeId: Id | null) {
    if (profiles.value.some((item) => item.id === targetId)) return false
    const workspaceId = activeWorkspaceId.value
    const favorite = favoriteRecords.value.find(
      (item) => item.workspaceId === workspaceId && item.targetId === targetId,
    )
    const node = sidebarNodes.value.find(
      (item) => item.workspaceId === workspaceId && item.targetId === targetId,
    )
    if (node && (node.id === parentId || node.id === beforeId)) return false
    try {
      // A favourite and a tree row are two views of the same target, so leaving
      // the favourites is part of landing in the tree.
      if (favorite) {
        await api.setFavorite(workspaceId, favorite.targetKind, targetId, false)
        await refresh()
      }
      if (!node) {
        const profile = profiles.value.find((item) => item.id === targetId)
        const resource = resources.value.find((item) => item.id === targetId)
        const target = profile ?? resource
        if (!target) return false
        const created = await api.createSidebarNode(
          workspaceId,
          profile ? 'profile' : 'resource',
          target.name,
          parentId,
          targetId,
        )
        await api.moveSidebarNode(
          created.id,
          parentId,
          nodePosition(workspaceId, parentId, beforeId, created.id),
        )
        await refresh()
        return true
      }
      await api.moveSidebarNode(
        node.id,
        parentId,
        nodePosition(workspaceId, parentId, beforeId, node.id),
      )
      await refresh()
      return true
    } catch (error) {
      report('Déplacement impossible', error)
      return false
    }
  }

  async function placeTab(tabId: Id, parentId: Id | null, beforeId: Id | null) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab) return
    if (!parentId) {
      const group = splitGroups.value.find((item) => item.tabIds.includes(tabId))
      const movingIds = group?.tabIds ?? [tabId]
      const rootItems = [
        ...tabs.value
          .filter(
            (item) =>
              item.workspaceId === tab.workspaceId &&
              item.organized &&
              !item.folderId &&
              !movingIds.includes(item.id),
          )
          .map((item) => ({ kind: 'tab' as const, id: item.id, position: item.position })),
        ...sidebarNodes.value
          .filter(
            (item) =>
              item.workspaceId === tab.workspaceId && item.kind === 'folder' && !item.parentId,
          )
          .map((item) => ({ kind: 'folder' as const, id: item.id, position: item.position })),
      ].sort((a, b) => a.position - b.position)
      const index = beforeId ? rootItems.findIndex((item) => item.id === beforeId) : -1
      const moving = movingIds.map((id) => ({ kind: 'tab' as const, id, position: 0 }))
      rootItems.splice(index >= 0 ? index : rootItems.length, 0, ...moving)
      for (const [position, item] of rootItems.entries()) {
        if (item.kind === 'tab') {
          const member = tabs.value.find((candidate) => candidate.id === item.id)
          if (!member) continue
          member.organized = true
          member.folderId = null
          member.position = position
        } else {
          const folder = sidebarNodes.value.find((candidate) => candidate.id === item.id)
          if (folder) folder.position = position
        }
      }
      await Promise.all(
        rootItems.filter((item) => item.kind === 'tab').map((item) => persistTab(item.id)),
      )
      if (isNative()) {
        await api.saveSidebarRootOrder(
          tab.workspaceId,
          rootItems.map((item) => item.id),
        )
      }
      if (group) await persistSplitGroup(group)
      return
    }
    const parent = sidebarNodes.value.find((item) => item.id === parentId)
    if (!parent || parent.kind !== 'folder') return
    setFolderCollapsed(parentId, false)
    const group = splitGroups.value.find((item) => item.tabIds.includes(tabId))
    for (const memberId of group?.tabIds ?? [tabId]) {
      const member = tabs.value.find((item) => item.id === memberId)
      if (!member) continue
      member.folderId = parentId
      member.organized = true
    }
    await reorderTabInFolder(tab.id, beforeId)
  }

  async function reorderTabInFolder(tabId: Id, beforeTabId: Id | null) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab?.folderId || tabId === beforeTabId) return
    const group = splitGroups.value.find((item) => item.tabIds.includes(tabId))
    const movingIds = group?.tabIds ?? [tabId]
    const ordered = tabs.value
      .filter(
        (item) =>
          item.workspaceId === tab.workspaceId &&
          item.folderId === tab.folderId &&
          !movingIds.includes(item.id),
      )
      .sort((a, b) => a.position - b.position)
    const anchor = beforeTabId ? ordered.findIndex((item) => item.id === beforeTabId) : -1
    const moving = movingIds.flatMap((id) => {
      const member = tabs.value.find((item) => item.id === id)
      return member ? [member] : []
    })
    ordered.splice(anchor >= 0 ? anchor : ordered.length, 0, ...moving)
    ordered.forEach((item, position) => (item.position = position))
    await Promise.all(ordered.map((item) => persistTab(item.id)))
  }

  async function pinTarget(targetId: Id, beforeFavoriteId: Id | null) {
    if (profiles.value.some((item) => item.id === targetId)) return false
    const target =
      favoriteRecords.value.find((item) => item.targetId === targetId) ??
      (() => {
        const node = sidebarNodes.value.find((item) => item.targetId === targetId)
        if (node) return { targetKind: recordTargetKind(node), targetId: node.targetId! }
        if (resources.value.some((item) => item.id === targetId))
          return { targetKind: 'resource' as const, targetId }
        return null
      })()
    const workspaceId = activeWorkspaceId.value
    if (!target || !workspaceId) return false
    try {
      let favorite = favoriteRecords.value.find(
        (item) => item.workspaceId === workspaceId && item.targetId === targetId,
      )
      if (favorite && favorite.id === beforeFavoriteId) return true
      if (!favorite) {
        await api.setFavorite(workspaceId, target.targetKind, targetId, true)
        await refresh()
        favorite = favoriteRecords.value.find(
          (item) => item.workspaceId === workspaceId && item.targetId === targetId,
        )
      }
      if (favorite) {
        const ordered = favoriteRecords.value
          .filter((item) => item.workspaceId === workspaceId && item.id !== favorite!.id)
          .sort((a, b) => a.position - b.position)
        const index = beforeFavoriteId
          ? ordered.findIndex((item) => item.id === beforeFavoriteId)
          : -1
        await api.moveFavorite(favorite.id, index >= 0 ? index : ordered.length)
        await refresh()
      }
      return true
    } catch (error) {
      report('Favori non enregistré', error)
      return false
    }
  }

  /**
   * Zen model: a tab lives in exactly one section. Pinning moves it above the
   * divider; unpinning moves it back. `beforeTabId` is the neighbour to land
   * in front of inside that section.
   */
  async function moveTab(tabId: Id, pinned: boolean, beforeTabId: Id | null = null) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab || tabId === beforeTabId) return
    const group = splitGroups.value.find((item) => item.tabIds.includes(tabId))
    const movingIds = new Set(group?.tabIds ?? [tabId])
    const moving = (group?.tabIds ?? [tabId]).flatMap((id) => {
      const member = tabs.value.find((item) => item.id === id)
      return member ? [member] : []
    })
    const siblings = tabs.value
      .filter((item) => item.workspaceId === tab.workspaceId && !movingIds.has(item.id))
      .sort((a, b) => a.position - b.position)
    const pinnedSiblings = siblings.filter((item) => item.organized)
    const openSiblings = siblings.filter((item) => !item.organized)
    for (const member of moving) {
      member.organized = pinned
      member.folderId = null
    }
    const bucket = pinned ? pinnedSiblings : openSiblings
    const index = beforeTabId ? bucket.findIndex((item) => item.id === beforeTabId) : -1
    bucket.splice(index >= 0 ? index : bucket.length, 0, ...moving)
    const ordered = pinned ? [...bucket, ...openSiblings] : [...pinnedSiblings, ...bucket]
    ordered.forEach((item, position) => (item.position = position))
    if (!pinned && isNative())
      await Promise.all(moving.map((item) => api.deleteTab(item.id).catch(() => undefined)))
    await Promise.all(ordered.filter((item) => item.organized).map((item) => persistTab(item.id)))
    if (group) {
      if (pinned) await persistSplitGroup(group)
      else if (isNative()) await api.deleteSplitGroup(group.id).catch(() => undefined)
    }
  }

  async function pinTab(tabId: Id, beforeTabId: Id | null = null) {
    await moveTab(tabId, true, beforeTabId)
  }

  async function unpinTab(tabId: Id, beforeTabId: Id | null = null) {
    await moveTab(tabId, false, beforeTabId)
  }

  /** `beforeTabId` is the tab the moved one must precede; `null` means last. */
  async function reorderTab(tabId: Id, beforeTabId: Id | null) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab) return
    await moveTab(tabId, tab.organized, beforeTabId)
  }

  const isFavorite = computed(() => {
    const pinned = new Set(
      favoriteRecords.value
        .filter((item) => item.workspaceId === activeWorkspaceId.value)
        .map((item) => item.targetId),
    )
    return (targetId: Id) => pinned.has(targetId)
  })

  async function toggleFavorite(targetKind: TargetKind, targetId: Id) {
    if (!activeWorkspaceId.value) return
    try {
      await api.setFavorite(
        activeWorkspaceId.value,
        targetKind,
        targetId,
        !isFavorite.value(targetId),
      )
      await refresh()
    } catch (error) {
      report('Favori non enregistré', error)
    }
  }

  /* ------------------------------------------------------------------ misc */
  async function openWindow() {
    try {
      await api.createWindow()
    } catch (error) {
      report('Nouvelle fenêtre impossible', error)
    }
  }

  function bindNativeEvents() {
    const unsubscribeLock = on('app-lock-changed', (value) => {
      locked.value = value
    })
    const unsubscribeSsh = on('ssh-state-changed', (payload) => {
      applySshState({
        sessionId: payload.sessionId,
        status: payload.status as SessionStatus,
        attempt: payload.attempt,
        replacementSessionId: payload.replacementSessionId,
      })
    })
    const unsubscribeExit = on('session-exited', ({ sessionId }) => {
      const session = sessions.value.find((item) => item.id === sessionId)
      if (!session || session.kind !== 'local') return
      const tab = tabs.value.find((item) => paneSessionIds(item.root).includes(sessionId))
      if (tab && !tab.organized && !tab.folderId) {
        void closeTab(tab.id, { force: true })
        return
      }
      session.status = 'closed'
      session.message = 'Processus terminé.'
    })
    return () => {
      unsubscribeLock()
      unsubscribeSsh()
      unsubscribeExit()
    }
  }

  return {
    /* state */
    workspaces,
    profiles,
    resources,
    identities,
    sidebarNodes,
    settings,
    preferences,
    detectedShells,
    sessions,
    tabs,
    splitGroups,
    notices,
    ready,
    sidebarPinned,
    sidebarPeek,
    sidebarOpen,
    route,
    settingsSection,
    paletteOpen,
    searchOpen,
    locked,
    pinConfigured,
    recoveryAvailable,
    renamingNodeId,
    pendingWorkspaceDelete,
    isSwitchingWorkspace,
    workspaceSwitchDirection,
    pendingTabClose,
    activeWorkspaceId,

    /* derived */
    activeWorkspace,
    workspaceProfiles,
    workspaceResources,
    workspaceIdentities,
    tree,
    favorites,
    visibleTabs,
    unfavoritedTabs,
    pinnedTabs,
    activeTabId,
    activeTab,
    activeSplitGroup,
    activeSession,
    activePaneSessionId,
    sessionById,
    appearance,
    workspaceContentCollapsed,
    defaultProfileId,
    isFavorite,
    isTargetActive,
    uniqueTabForTarget,

    /* actions */
    initialize,
    bindNativeEvents,
    applySnapshot,
    applyPresentation,
    refresh,
    switchWorkspace,
    cycleWorkspace,
    createWorkspace,
    updateWorkspace,
    reorderWorkspace,
    deleteWorkspace,
    isFolderCollapsed,
    setFolderCollapsed,
    toggleFolder,
    toggleWorkspaceContent,
    openTarget,
    createTerminal,
    activateRestorableSession,
    reconnectSession,
    setSessionContext,
    focusSession,
    selectTab,
    startStoppedTab,
    selectPane,
    renameTab,
    organizeTab,
    splitActivePane,
    linkTabs,
    transferTab,
    setGroupSplitRatio,
    detachFromSplit,
    setSplitRatio,
    closePane,
    stopTab,
    closeTab,
    dismissRecovery,
    updateSettings,
    updatePreferences,
    setTheme,
    lock,
    unlock,
    configurePin,
    createFolder,
    createFolderAfter,
    createLocalProfile,
    createSshResource,
    nodeIdForTarget,
    restoreDefaults,
    renameNode,
    deleteNode,
    moveNode,
    reparentNode,
    placeTarget,
    placeTab,
    pinTarget,
    pinTab,
    unpinTab,
    reorderTab,
    reorderTabInFolder,
    toggleFavorite,
    openWindow,
    persistWindowState,
    notify,
    dismissNotice,
    describeTarget,
    paneSessionIds,
  }
})
