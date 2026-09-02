/**
 * Wire types mirrored from the Rust command boundary (`src-tauri/src/domain.rs`,
 * `pty.rs`, `ssh.rs`). Every Rust struct there carries
 * `#[serde(rename_all = "camelCase")]`, so the names below must stay camelCase.
 */

import { platformDefaultShell } from '@/lib/shells'

export type Id = string

export interface Workspace {
  id: Id
  name: string
  icon: string
  color: string
  position: number
  defaultProfileId: Id | null
}

export interface LocalProfile {
  id: Id
  workspaceId: Id
  name: string
  executable: string
  args: string[]
  workingDirectory: string | null
}

export interface Resource {
  id: Id
  workspaceId: Id
  name: string
  sshAlias: string | null
  host: string | null
  port: number | null
  identityId: Id | null
}

export interface Identity {
  id: Id
  workspaceId: Id
  name: string
  username: string
  identityFile: string | null
}

export type SidebarNodeKind = 'folder' | 'profile' | 'resource'

export interface SidebarNodeRecord {
  id: Id
  workspaceId: Id
  parentId: Id | null
  kind: SidebarNodeKind
  label: string
  targetId: Id | null
  position: number
}

export type TargetKind = 'profile' | 'resource'

export interface FavoriteRecord {
  id: Id
  workspaceId: Id
  targetKind: TargetKind
  targetId: Id
  position: number
}

export interface SavedSession {
  id: Id
  workspaceId: Id
  targetKind: TargetKind
  targetId: Id
  workingDirectory: string | null
}

export type SplitDirection = 'horizontal' | 'vertical'

export type PaneTree =
  | { kind: 'pane'; sessionId: Id }
  | { kind: 'split'; direction: SplitDirection; ratio: number; first: PaneTree; second: PaneTree }

export interface Tab {
  id: Id
  workspaceId: Id
  name: string
  root: PaneTree | null
  position: number
  organized: boolean
  folderId?: Id | null
}

export type SplitTabTree =
  | { kind: 'tab'; tabId: Id }
  | {
      kind: 'split'
      direction: SplitDirection
      ratio: number
      first: SplitTabTree
      second: SplitTabTree
    }

export interface SplitGroupRecord {
  id: Id
  workspaceId: Id
  tabIds: Id[]
  root: SplitTabTree
}

export interface WindowState {
  id: Id
  activeWorkspaceId: Id | null
  activeTabId: Id | null
  x: number | null
  y: number | null
  width: number
  height: number
  maximized: boolean
  sidebarHidden: boolean
}

export interface AppState {
  cleanShutdown: boolean
  recoveryAvailable: boolean
}

export type ThemePreference = 'dark' | 'light' | 'system'

/** Exactly the fields `domain::Settings` persists — no more, no less. */
export interface Settings {
  theme: ThemePreference
  fontFamily: string
  fontSize: number
  /** Executable used when « Nouveau terminal » opens a local shell. */
  defaultShell: string
}

export interface AppData {
  workspaces: Workspace[]
  profiles: LocalProfile[]
  resources: Resource[]
  identities: Identity[]
  sidebarNodes: SidebarNodeRecord[]
  favorites: FavoriteRecord[]
  savedSessions: SavedSession[]
  tabs: Tab[]
  splitGroups: SplitGroupRecord[]
  windows: WindowState[]
  settings: Settings
  appState: AppState
}

export interface SshTarget {
  alias: string
  host: string | null
  user: string | null
  port: number | null
  identityFile: string | null
}

export interface ResolvedSshTarget {
  destination: string
  host: string
  user: string
  port: number
  identityFiles: string[]
}

export type SshStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'closed'

export interface SpawnedSession {
  id: Id
}

export interface SshConnectionResult {
  sessionId: Id
  resolved: ResolvedSshTarget
}

/* ---------------------------------------------------------------- events */

export interface TerminalOutputEvent {
  sessionId: Id
  dataBase64: string
}

export interface SshStateChangedEvent {
  sessionId: Id
  status: SshStatus
  attempt: number
  /** Set when a retry produced a new PTY that replaces the failed one. */
  replacementSessionId: Id | null
}

export interface SessionExitedEvent {
  sessionId: Id
}

export const defaultSettings: Settings = {
  theme: 'system',
  fontFamily: 'Cascadia Mono',
  fontSize: 14,
  defaultShell: platformDefaultShell(),
}
