import type { Entry } from '../bindings'

export type {
  Direction,
  Entry,
  Layout,
  PersistedSpace,
  Row,
  Sidebar,
  Split,
  Tab,
  TabView,
  Target,
} from '../bindings'

export type Id = string

export type Folder = Extract<Entry, { kind: 'folder' }>
