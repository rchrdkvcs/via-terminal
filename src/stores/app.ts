import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { api, describeError, isNative } from '@/ipc/client'
import { on } from '@/ipc/events'
import type {
  AppData,
  Density,
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
  Tab,
  TargetKind,
  ThemePreference,
  Workspace,
} from '@/ipc/types'
import { defaultSettings } from '@/ipc/types'
import { terminals } from '@/terminal/registry'
import { loadPreferences, savePreferences, type LocalPreferences } from '@/lib/preferences'

export type SessionKind = 'local' | 'ssh'

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
}

export interface Notice {
  id: string
  kind: 'info' | 'error' | 'success'
  message: string
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
  const detectedShells = shallowRef<string[]>([])

  /* -------------------------------------------------------------- runtime */
  const sessions = ref<SessionSummary[]>([])
  const tabs = ref<RuntimeTab[]>([])
  const activeWorkspaceId = ref<Id>('')
  /** Remembered per workspace so switching back restores the same tab. */
  const activeTabPerWorkspace = ref<Record<Id, Id | undefined>>({})
  const notices = ref<Notice[]>([])

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
  const windowId = ref<Id>(identifier())

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

  /** Sessions grouped by the target that produced them, for sidebar badges. */
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
    const favoriteTargetIds = new Set(
      favoriteRecords.value
        .filter((item) => item.workspaceId === activeWorkspaceId.value)
        .map((item) => item.targetId),
    )
    const records = sidebarNodes.value
      .filter((node) => node.workspaceId === activeWorkspaceId.value)
      .filter((node) => !node.targetId || !favoriteTargetIds.has(node.targetId))
      .sort((a, b) => a.position - b.position)

    const byId = new Map<Id, TreeNode>()
    for (const record of records) {
      byId.set(record.id, {
        id: record.id,
        parentId: record.parentId,
        kind: record.kind,
        label:
          (record.targetId && targetName(recordTargetKind(record), record.targetId)) ||
          record.label,
        targetId: record.targetId,
        depth: 0,
        children: [],
        sessionIds: record.targetId ? (sessionsByTarget.value.get(record.targetId) ?? []) : [],
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
      }
    }
    assignDepth(roots, 0)
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

  const unfavoritedTabs = computed(() => {
    const favoriteTargetIds = new Set(favorites.value.map((favorite) => favorite.targetId))
    return visibleTabs.value.filter((tab) => {
      const firstSessionId = paneSessionIds(tab.root)[0]
      const targetId = sessions.value.find((session) => session.id === firstSessionId)?.targetId
      return !targetId || !favoriteTargetIds.has(targetId)
    })
  })

  const activeTabId = computed(() => activeTabPerWorkspace.value[activeWorkspaceId.value] ?? '')
  const activeTab = computed(
    () => visibleTabs.value.find((tab) => tab.id === activeTabId.value) ?? null,
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

  function replacePane(node: PaneNode, id: string, replacement: PaneNode): PaneNode {
    if (node.kind === 'pane') return node.id === id ? replacement : node
    return {
      ...node,
      first: replacePane(node.first, id, replacement),
      second: replacePane(node.second, id, replacement),
    }
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

  /* -------------------------------------------------------------- notices */
  function notify(kind: Notice['kind'], message: string) {
    const notice: Notice = { id: identifier(), kind, message }
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
    if (layoutTimer) clearTimeout(layoutTimer)
    layoutTimer = setTimeout(() => void persistTab(tabId), 400)
  }

  async function persistTab(tabId: Id) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab) return
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
        },
        descriptors,
      )
    } catch (error) {
      report('Impossible d’enregistrer la disposition', error)
    }
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
    profiles.value = data.profiles
    resources.value = data.resources
    identities.value = data.identities
    sidebarNodes.value = data.sidebarNodes
    favoriteRecords.value = data.favorites
    savedSessions.value = data.savedSessions
    savedTabs.value = data.tabs
    settings.value = { ...defaultSettings, ...data.settings }
    if (!workspaces.value.some((item) => item.id === activeWorkspaceId.value))
      activeWorkspaceId.value = workspaces.value[0]?.id ?? ''
    applyPresentation()
  }

  function applyPresentation() {
    terminals.setPresentation({
      fontFamily: `${settings.value.fontFamily}, ui-monospace, Consolas, monospace`,
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
      const [data, isLocked, recovery, shells] = await Promise.all([
        api.snapshot(),
        api.isLocked(),
        api.recoveryState(),
        api.detectProfiles().catch(() => [] as string[]),
      ])
      applySnapshot(data)
      locked.value = isLocked
      pinConfigured.value = isLocked
      recoveryAvailable.value = recovery.recoveryAvailable
      detectedShells.value = shells
      if (!recovery.recoveryAvailable) restoreLayout()
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
      if (!saved.root) continue
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
      }
      tabs.value.push(runtime)
      activeTabPerWorkspace.value[saved.workspaceId] ??= runtime.id
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
    activeWorkspaceId.value = id
    const remembered = activeTabPerWorkspace.value[id]
    if (!remembered || !tabs.value.some((tab) => tab.id === remembered))
      activeTabPerWorkspace.value[id] = visibleTabs.value[0]?.id
    void persistWindowState()
  }

  function cycleWorkspace(direction: 1 | -1) {
    if (workspaces.value.length < 2) return
    const index = workspaces.value.findIndex((item) => item.id === activeWorkspaceId.value)
    const next = (index + direction + workspaces.value.length) % workspaces.value.length
    switchWorkspace(workspaces.value[next].id)
  }

  async function createWorkspace(name: string, icon = 'terminal') {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const workspace = await api.createWorkspace(trimmed, icon)
      applySnapshot(await api.snapshot())
      switchWorkspace(workspace.id)
      notify('success', `Espace de travail « ${workspace.name} » créé.`)
    } catch (error) {
      report('Création de l’espace de travail impossible', error)
    }
  }

  async function duplicateWorkspace(id: Id, name: string) {
    try {
      const workspace = await api.duplicateWorkspace(id, name.trim())
      applySnapshot(await api.snapshot())
      switchWorkspace(workspace.id)
      notify('success', `Espace de travail dupliqué en « ${workspace.name} ».`)
    } catch (error) {
      report('Duplication impossible', error)
    }
  }

  /* --------------------------------------------------------------- sessions */
  function registerSession(session: SessionSummary) {
    sessions.value.push(session)
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
    // PRODUCT.md: clicking an open favorite focuses it; a secondary action opens another.
    if (options.reuse !== false && existing) {
      focusSession(existing)
      return
    }
    const session = await startSession(targetKind, targetId)
    if (session) openSessionInTab(session)
  }

  function openSessionInTab(session: SessionSummary) {
    const paneId = identifier()
    const tab: RuntimeTab = {
      id: identifier(),
      workspaceId: session.workspaceId,
      name: session.name,
      root: { kind: 'pane', id: paneId, sessionId: session.id },
      activePaneId: paneId,
      position: nextPosition(session.workspaceId),
    }
    tabs.value.push(tab)
    activeTabPerWorkspace.value[session.workspaceId] = tab.id
    scheduleLayoutSave(tab.id)
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

  function selectTab(id: Id) {
    const tab = tabs.value.find((item) => item.id === id)
    if (!tab) return
    activeTabPerWorkspace.value[tab.workspaceId] = id
    const pane = findPane(tab.root, tab.activePaneId) ?? firstPane(tab.root)
    if (pane) terminals.focus(pane.sessionId)
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
      notify('error', 'Aucun profil local n’est configuré dans cet espace de travail.')
      return
    }
    const session = await startSession('profile', id)
    if (session) openSessionInTab(session)
  }

  async function splitActivePane(direction: SplitDirection) {
    const tab = activeTab.value
    if (!tab) return
    const current = findPane(tab.root, tab.activePaneId) ?? firstPane(tab.root)
    if (!current) return
    const source = sessionById.value.get(current.sessionId)
    const targetKind = source?.targetKind ?? 'profile'
    const targetId = source?.targetKind === 'profile' ? source.targetId : defaultProfileId.value
    if (!targetId) return
    const session = await startSession(targetKind === 'resource' ? 'profile' : targetKind, targetId)
    if (!session) return
    const paneId = identifier()
    tab.root = replacePane(tab.root, current.id, {
      kind: 'split',
      id: identifier(),
      direction,
      ratio: 0.5,
      first: current,
      second: { kind: 'pane', id: paneId, sessionId: session.id },
    })
    tab.activePaneId = paneId
    scheduleLayoutSave(tab.id)
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
    const siblings = visibleTabs.value.filter((item) => item.id !== id)
    for (const sessionId of paneSessionIds(tab.root)) await terminateSession(sessionId)
    tabs.value.splice(index, 1)
    activeTabPerWorkspace.value[workspaceId] = siblings[0]?.id
    if (isNative()) await api.deleteTab(id).catch(() => undefined)
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
      void api.updateSettings({ ...settings.value }).catch((error) => {
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

  function setDensity(density: Density) {
    updateSettings({ density })
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

  async function createFolder(label: string, parentId: Id | null = null) {
    if (!activeWorkspaceId.value || !label.trim()) return
    try {
      await api.createSidebarNode(activeWorkspaceId.value, 'folder', label.trim(), parentId)
      await refresh()
    } catch (error) {
      report('Création du dossier impossible', error)
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
      updateSettings({ density: defaultSettings.density, restoreLocalSessions: false })
      updatePreferences({ sidebarRevealDelay: 180, confirmOnClose: true })
    } else if (section === 'appearance') {
      updateSettings({ theme: defaultSettings.theme })
    } else if (section === 'terminal') {
      updateSettings({
        fontFamily: defaultSettings.fontFamily,
        fontSize: defaultSettings.fontSize,
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
      await api.deleteSidebarNode(id)
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

  async function reparentNode(id: Id, parentId: Id | null, position: number) {
    try {
      await api.moveSidebarNode(id, parentId, position)
      await refresh()
    } catch (error) {
      report('Déplacement impossible', error)
    }
  }

  function tabTarget(tabId: Id) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab) return null
    const session = sessionById.value.get(paneSessionIds(tab.root)[0])
    return session ? { kind: session.targetKind, id: session.targetId } : null
  }

  async function placeTarget(targetId: Id, parentId: Id | null, position: number) {
    const favorite = favoriteRecords.value.find(
      (item) => item.workspaceId === activeWorkspaceId.value && item.targetId === targetId,
    )
    let node = sidebarNodes.value.find(
      (item) => item.workspaceId === activeWorkspaceId.value && item.targetId === targetId,
    )
    try {
      if (favorite)
        await api.setFavorite(activeWorkspaceId.value, favorite.targetKind, targetId, false)
      if (!node) {
        const profile = profiles.value.find((item) => item.id === targetId)
        const resource = resources.value.find((item) => item.id === targetId)
        const target = profile ?? resource
        if (!target) return
        node = await api.createSidebarNode(
          activeWorkspaceId.value,
          profile ? 'profile' : 'resource',
          target.name,
          parentId,
          targetId,
        )
        await refresh()
        return
      }
      if (node.parentId === parentId) {
        const siblings = sidebarNodes.value
          .filter((item) => item.parentId === parentId && item.workspaceId === node!.workspaceId)
          .sort((a, b) => a.position - b.position)
        if (siblings.findIndex((item) => item.id === node!.id) < position) position -= 1
      }
      await api.moveSidebarNode(node.id, parentId, position)
      await refresh()
    } catch (error) {
      report('Déplacement impossible', error)
    }
  }

  async function placeTab(tabId: Id, parentId: Id | null, position: number) {
    const target = tabTarget(tabId)
    if (target) await placeTarget(target.id, parentId, position)
  }

  async function pinTarget(targetId: Id, position: number) {
    const target =
      favoriteRecords.value.find((item) => item.targetId === targetId) ??
      (() => {
        const node = sidebarNodes.value.find((item) => item.targetId === targetId)
        if (node) return { targetKind: recordTargetKind(node), targetId: node.targetId! }
        if (profiles.value.some((item) => item.id === targetId))
          return { targetKind: 'profile' as const, targetId }
        if (resources.value.some((item) => item.id === targetId))
          return { targetKind: 'resource' as const, targetId }
        return null
      })()
    if (!target || !activeWorkspaceId.value) return
    try {
      let favorite = favoriteRecords.value.find((item) => item.targetId === targetId)
      if (!favorite) {
        await api.setFavorite(activeWorkspaceId.value, target.targetKind, targetId, true)
        await refresh()
        favorite = favoriteRecords.value.find((item) => item.targetId === targetId)
      }
      if (favorite) {
        const ordered = favoriteRecords.value
          .filter((item) => item.workspaceId === activeWorkspaceId.value)
          .sort((a, b) => a.position - b.position)
        if (ordered.findIndex((item) => item.id === favorite!.id) < position) position -= 1
        await api.moveFavorite(favorite.id, position)
      }
      await refresh()
    } catch (error) {
      report('Favori non enregistré', error)
    }
  }

  async function pinTab(tabId: Id, position: number) {
    const target = tabTarget(tabId)
    if (target) await pinTarget(target.id, position)
  }

  async function reorderTab(tabId: Id, position: number) {
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab) return
    const ordered = tabs.value
      .filter((item) => item.workspaceId === tab.workspaceId && item.id !== tabId)
      .sort((a, b) => a.position - b.position)
    ordered.splice(Math.max(0, Math.min(position, ordered.length)), 0, tab)
    ordered.forEach((item, index) => (item.position = index))
    await Promise.all(ordered.map((item) => persistTab(item.id)))
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
    // A local shell that exits keeps its scrollback on screen; only its state
    // changes, so the user can read the last output before closing the pane.
    const unsubscribeExit = on('session-exited', ({ sessionId }) => {
      const session = sessions.value.find((item) => item.id === sessionId)
      if (!session || session.kind !== 'local') return
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
    activeTabId,
    activeTab,
    activeSession,
    activePaneSessionId,
    sessionById,
    appearance,
    defaultProfileId,
    isFavorite,

    /* actions */
    initialize,
    bindNativeEvents,
    applySnapshot,
    applyPresentation,
    refresh,
    switchWorkspace,
    cycleWorkspace,
    createWorkspace,
    duplicateWorkspace,
    openTarget,
    createTerminal,
    activateRestorableSession,
    reconnectSession,
    focusSession,
    selectTab,
    selectPane,
    renameTab,
    splitActivePane,
    setSplitRatio,
    closePane,
    closeTab,
    dismissRecovery,
    updateSettings,
    updatePreferences,
    setTheme,
    setDensity,
    lock,
    unlock,
    configurePin,
    createFolder,
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
    reorderTab,
    toggleFavorite,
    openWindow,
    persistWindowState,
    notify,
    dismissNotice,
    describeTarget,
    paneSessionIds,
  }
})
