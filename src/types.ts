export type SessionKind = 'local' | 'ssh'
export type SessionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed' | 'closed'

export interface Workspace {
  id: string
  name: string
  icon: string
  color: string
  position: number
  activity?: boolean
  defaultProfileId?: string | null
}
export interface LocalProfile {
  id: string
  workspaceId: string
  name: string
  executable: string
  args: string[]
  workingDirectory?: string | null
}
export interface Resource {
  id: string
  workspaceId: string
  name: string
  sshAlias?: string | null
  host?: string | null
  port?: number | null
  identityId?: string | null
}
export interface AppSnapshot {
  workspaces: Workspace[]
  profiles: LocalProfile[]
  resources: Resource[]
  sidebarNodes: Array<{
    id: string
    workspaceId: string
    parentId?: string | null
    kind: string
    label: string
    targetId?: string | null
    position: number
  }>
  favorites: Array<{
    id: string
    workspaceId: string
    targetKind: string
    targetId: string
    position: number
  }>
  settings: Partial<Settings> & { restoreLocalSessions?: boolean }
}
export interface Favorite {
  id: string
  name: string
  icon: string
  kind: SessionKind
  targetId: string
  sessionId?: string
}
export interface SidebarNode {
  id: string
  name: string
  kind: 'folder' | 'profile' | 'resource'
  icon?: string
  children?: SidebarNode[]
  sessions?: SessionSummary[]
}
export interface SessionSummary {
  id: string
  name: string
  kind: SessionKind
  status: SessionStatus
  workspaceId: string
}
export interface Tab {
  id: string
  name: string
  workspaceId: string
  sessionId?: string
  secondarySessionId?: string
  split?: 'horizontal' | 'vertical'
}
export interface Settings {
  theme: 'dark' | 'light' | 'system'
  density: 'comfortable' | 'compact'
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'bar' | 'underline'
  sidebarRevealDelay: number
}

export const defaultSettings: Settings = {
  theme: 'dark',
  density: 'comfortable',
  fontSize: 14,
  fontFamily: 'Cascadia Code, monospace',
  cursorStyle: 'bar',
  sidebarRevealDelay: 180,
}
