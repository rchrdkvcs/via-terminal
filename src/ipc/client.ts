import { invoke } from '@tauri-apps/api/core'
import type {
  AppData,
  AppState,
  Id,
  Identity,
  LocalProfile,
  Resource,
  SavedSession,
  Settings,
  SidebarNodeKind,
  SidebarNodeRecord,
  SpawnedSession,
  SshConnectionResult,
  SshStatus,
  SshTarget,
  SshHostInput,
  Tab,
  SplitGroupRecord,
  TargetKind,
  WindowState,
  Workspace,
} from './types'

/**
 * The webview also runs under `vite dev` in a plain browser, where no native
 * command exists. Everything native goes through `call`, so the rest of the
 * application never has to test for the host.
 */
export function isNative(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export class NativeUnavailableError extends Error {
  constructor(command: string) {
    super(`La commande native « ${command} » est indisponible hors de l’application.`)
    this.name = 'NativeUnavailableError'
  }
}

async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isNative()) throw new NativeUnavailableError(command)
  return invoke<T>(command, args)
}

export const api = {
  saveSshHost: (input: SshHostInput) => call<Resource>('ssh_host_save', { input }),
  /* ------------------------------------------------------------- lifecycle */
  snapshot: () => call<AppData>('app_snapshot'),
  recoveryState: () => call<AppState>('app_recovery_state'),
  finishRecovery: () => call<void>('app_recovery_finish'),
  markCleanShutdown: () => call<void>('app_mark_clean_shutdown'),

  /* ------------------------------------------------------------ workspaces */
  listWorkspaces: () => call<Workspace[]>('workspace_list'),
  createWorkspace: (name: string, icon?: string, color?: string, defaultShell?: string) =>
    call<Workspace>('workspace_create', {
      name,
      icon: icon ?? null,
      color: color ?? null,
      defaultShell: defaultShell ?? null,
    }),
  moveWorkspace: (id: Id, beforeId: Id | null) =>
    call<Workspace>('workspace_move', { id, beforeId }),
  updateWorkspace: (id: Id, name: string, icon: string, defaultShell?: string) =>
    call<Workspace>('workspace_update', { id, name, icon, defaultShell: defaultShell ?? null }),
  deleteWorkspace: (id: Id) => call<void>('workspace_delete', { id }),

  /* ------------------------------------------------- profiles and resources */
  detectProfiles: () => call<string[]>('profile_detect'),
  createProfile: (
    workspaceId: Id,
    name: string,
    executable: string,
    args: string[] = [],
    workingDirectory: string | null = null,
  ) =>
    call<LocalProfile>('profile_create', { workspaceId, name, executable, args, workingDirectory }),
  createIdentity: (
    workspaceId: Id,
    name: string,
    username: string,
    identityFile: string | null = null,
  ) => call<Identity>('identity_create', { workspaceId, name, username, identityFile }),
  createResource: (
    workspaceId: Id,
    name: string,
    host: string | null,
    sshAlias: string | null,
    port: number | null,
    identityId: Id | null,
  ) => call<Resource>('resource_create', { workspaceId, name, host, sshAlias, port, identityId }),

  /* -------------------------------------------------- sidebar organization */
  createSidebarNode: (
    workspaceId: Id,
    kind: SidebarNodeKind,
    label: string,
    parentId: Id | null = null,
    targetId: Id | null = null,
  ) =>
    call<SidebarNodeRecord>('sidebar_node_create', {
      workspaceId,
      kind,
      label,
      parentId,
      targetId,
    }),
  renameSidebarNode: (id: Id, label: string) =>
    call<SidebarNodeRecord>('sidebar_node_rename', { id, label }),
  moveSidebarNode: (id: Id, parentId: Id | null, position: number) =>
    call<SidebarNodeRecord>('sidebar_node_move', { id, parentId, position }),
  saveSidebarRootOrder: (workspaceId: Id, ids: Id[]) =>
    call<void>('sidebar_root_order_save', { workspaceId, ids }),
  deleteSidebarNode: (id: Id) => call<void>('sidebar_node_delete', { id }),
  setFavorite: (workspaceId: Id, targetKind: TargetKind, targetId: Id, pinned: boolean) =>
    call<void>('favorite_set', { workspaceId, targetKind, targetId, pinned }),
  moveFavorite: (id: Id, position: number) => call<void>('favorite_move', { id, position }),

  /* ---------------------------------------------------------------- layout */
  saveTab: (tab: Tab, sessions: SavedSession[]) => call<Tab>('tab_save', { tab, sessions }),
  saveSplitGroup: (group: SplitGroupRecord) =>
    call<SplitGroupRecord>('split_group_save', { group }),
  deleteSplitGroup: (id: Id) => call<void>('split_group_delete', { id }),
  deleteTab: (id: Id) => call<void>('tab_delete', { id }),
  saveWindowState: (window: WindowState) => call<WindowState>('window_state_save', { window }),

  /* -------------------------------------------------------------- settings */
  getSettings: () => call<Settings>('settings_get'),
  updateSettings: (settings: Settings) => call<Settings>('settings_update', { settings }),

  /* --------------------------------------------------------- import/export */
  exportData: (path: string | null = null) => call<string>('export_create', { path }),
  validateImport: (json: string) => call<AppData>('import_validate', { json }),
  applyImport: (json: string) => call<AppData>('import_apply', { json }),

  /* -------------------------------------------------------------- sessions */
  spawnSession: (workspaceId: Id, profileId: Id, cols: number, rows: number) =>
    call<SpawnedSession>('session_spawn', { workspaceId, profileId, cols, rows }),
  connectSsh: (workspaceId: Id, resourceId: Id, identityId: Id, cols: number, rows: number) =>
    call<SshConnectionResult>('ssh_session_connect', {
      workspaceId,
      resourceId,
      identityId,
      cols,
      rows,
    }),
  sshStatus: (id: Id) => call<SshStatus>('ssh_session_status', { id }),
  listSshTargets: () => call<SshTarget[]>('ssh_config_list'),
  writeSession: (id: Id, data: string) => call<void>('session_write', { id, data }),
  resizeSession: (id: Id, cols: number, rows: number) =>
    call<void>('session_resize', { id, cols, rows }),
  closeSession: (id: Id) => call<void>('session_close', { id }),

  /* ----------------------------------------------------------------- shell */
  createWindow: () => call<void>('window_create'),
}

/**
 * Rust returns `Result<_, String>`, which reaches the webview as a bare string
 * rather than an `Error`. Normalising it here keeps error handling identical
 * at every call site.
 */
export function describeError(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return String(error)
}
