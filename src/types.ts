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
