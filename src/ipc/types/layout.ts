export type Id = string

export type Target =
  | { kind: 'local'; shell: string | null; cwd: string | null }
  | { kind: 'host'; hostId: Id }
  | { kind: 'quick'; address: string; port: number | null; username: string | null }

export interface Tab {
  id: Id

  title: string | null
  remoteCwd?: string | null
  target: Target
}

export type Direction = 'horizontal' | 'vertical'

export interface Split {
  id: Id
  direction: Direction

  sizes: number[]
  tabs: Tab[]
}

export type Row = ({ kind: 'tab' } & Tab) | ({ kind: 'split' } & Split)

export interface Folder {
  kind: 'folder'
  id: Id
  name: string
  open: boolean
  rows: Row[]
}

export type Entry = Row | Folder

export interface PersistedSpace {
  id: Id
  name: string
  icon: string
  defaultShell: string | null
  pinned: Entry[]
}

export interface Layout {
  activeSpaceId: Id | null
  sidebar: { width: number; visible: boolean }
  spaces: PersistedSpace[]
}
