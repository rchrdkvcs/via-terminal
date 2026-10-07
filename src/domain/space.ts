import type { Entry, Folder, Id, PersistedSpace, Row, Split, Tab } from '@/ipc/types'

export interface Space extends PersistedSpace {
  temporary: Row[]
}

export type Area = 'pinned' | 'temporary'

export interface Location {
  area: Area
  folderId: Id | null
  index: number
}

export function tabsOf(row: Row): Tab[] {
  return row.kind === 'split' ? row.tabs : [row]
}

export function isFolder(entry: Entry): entry is Folder {
  return entry.kind === 'folder'
}

export function rows(space: Space): Row[] {
  const pinned = space.pinned.flatMap((entry) => (isFolder(entry) ? entry.rows : [entry]))
  return [...pinned, ...space.temporary]
}

export function tabs(space: Space): Tab[] {
  return rows(space).flatMap(tabsOf)
}

export function rowOfTab(space: Space, tabId: Id): Row | undefined {
  return rows(space).find((row) => tabsOf(row).some((tab) => tab.id === tabId))
}

export function rowOf(space: Space, id: Id): Row | undefined {
  return rows(space).find((row) => row.id === id) ?? rowOfTab(space, id)
}

export function findTab(space: Space, tabId: Id): Tab | undefined {
  return tabs(space).find((tab) => tab.id === tabId)
}

export function isPinned(space: Space, id: Id): boolean {
  return locate(space, rowOf(space, id)?.id ?? id)?.area === 'pinned'
}

export function locate(space: Space, id: Id): Location | undefined {
  const temporary = space.temporary.findIndex((row) => row.id === id)
  if (temporary >= 0) return { area: 'temporary', folderId: null, index: temporary }
  for (const [index, entry] of space.pinned.entries()) {
    if (entry.id === id) return { area: 'pinned', folderId: null, index }
    if (!isFolder(entry)) continue
    const inner = entry.rows.findIndex((row) => row.id === id)
    if (inner >= 0) return { area: 'pinned', folderId: entry.id, index: inner }
  }
  return undefined
}

export function folderOf(space: Space, rowId: Id): Folder | undefined {
  const location = locate(space, rowId)
  if (!location?.folderId) return undefined
  return space.pinned.find((entry): entry is Folder => entry.id === location.folderId)
}

export function newTabRow(tab: Tab): Row {
  return { kind: 'tab', ...tab }
}

export function tabFromRow(row: Row & { kind: 'tab' }): Tab {
  return {
    id: row.id,
    title: row.title,
    target: row.target,
    ...(row.remoteCwd ? { remoteCwd: row.remoteCwd } : {}),
    ...(row.view ? { view: row.view } : {}),
  }
}

export function splitOf(space: Space, tabId: Id): Split | undefined {
  const row = rowOfTab(space, tabId)
  return row?.kind === 'split' ? row : undefined
}

export function toPersisted(space: Space): PersistedSpace {
  const { temporary: _temporary, ...persisted } = space
  return persisted
}

export function fromPersisted(space: PersistedSpace): Space {
  return { ...space, temporary: [] }
}

export function successor(space: Space, tabId: Id): Id | undefined {
  const row = rowOfTab(space, tabId)
  const sibling = row && tabsOf(row).find((tab) => tab.id !== tabId)
  if (sibling) return sibling.id
  const all = rows(space)
  const index = all.findIndex((candidate) => candidate.id === row?.id)
  const neighbor = all[index + 1] ?? all[index - 1]
  return neighbor && tabsOf(neighbor)[0].id
}
