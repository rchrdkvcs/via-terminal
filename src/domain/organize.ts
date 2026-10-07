import type { Folder, Id, Row, Tab } from '@/ipc/types'
import { clone } from '@/lib/clone'
import { withinLimits } from './limits'
import { insertAt, listOf, take } from './lists'
import { type Space, findTab, isFolder, isPinned, locate, rows, tabs } from './space'
import { detach, dropTab, resize, splitWith, type Edge } from './split'

export type Place =
  | { area: 'pinned'; folderId: Id | null; before: Id | null }
  | { area: 'temporary'; before: Id | null }

export type Intent =
  | { type: 'open'; row: Row; to?: Place }
  | { type: 'move'; id: Id; to: Place }
  | { type: 'remove'; id: Id }
  | { type: 'split'; source: Id; target: Id; edge: Edge }
  | { type: 'detach'; tabId: Id }
  | { type: 'resize'; splitId: Id; sizes: number[] }
  | { type: 'updateTab'; tabId: Id; patch: Partial<Omit<Tab, 'id'>> }
  | { type: 'navigate'; tabId: Id; side: 'local' | 'remote'; path: string }
  | { type: 'createFolder'; folder: Folder; before: Id | null }
  | { type: 'renameFolder'; id: Id; name: string }
  | { type: 'toggleFolder'; id: Id; open?: boolean }
  | { type: 'deleteFolder'; id: Id }

export function apply(space: Space, intent: Intent | readonly Intent[]): Space | null {
  const next = clone(space) as Space
  const intents = 'type' in intent ? [intent] : intent
  return intents.every((change) => run(next, change)) && withinLimits(next) ? next : null
}

export function transfer(from: Space, to: Space, rowId: Id): [Space, Space] | null {
  const row = rows(from).find((candidate) => candidate.id === rowId)
  if (!row || from.id === to.id) return null
  const pinned = locate(from, rowId)?.area === 'pinned'
  const place = pinned ? ({ area: 'pinned', folderId: null, before: null } as const) : undefined
  const source = apply(from, { type: 'remove', id: rowId })
  const destination = apply(to, { type: 'open', row: clone(row), to: place })
  return source && destination ? [source, destination] : null
}

function run(space: Space, intent: Intent): boolean {
  switch (intent.type) {
    case 'open': {
      if (!intent.to) return space.temporary.unshift(intent.row) > 0
      const { to } = intent
      const list = listOf(space, to.area, to.area === 'pinned' ? to.folderId : null)
      return list !== undefined && insertAt(list, intent.row, to.before)
    }
    case 'move':
      return move(space, intent.id, intent.to)
    case 'remove':
      return remove(space, intent.id)
    case 'split':
      return splitWith(space, intent.source, intent.target, intent.edge)
    case 'detach':
      return detach(space, intent.tabId)
    case 'resize':
      return resize(space, intent.splitId, intent.sizes)
    case 'updateTab':
      return updateTab(space, intent.tabId, intent.patch)
    case 'navigate':
      return navigate(space, intent.tabId, intent.side, intent.path)
    case 'createFolder':
      return insertAt(space.pinned, intent.folder, intent.before)
    case 'renameFolder':
      return withFolder(space, intent.id, (folder) => {
        const name = intent.name.trim()
        if (!name) return false
        folder.name = name
        return true
      })
    case 'toggleFolder':
      return withFolder(space, intent.id, (folder) => {
        folder.open = intent.open ?? !folder.open
        return true
      })
    case 'deleteFolder': {
      const index = space.pinned.findIndex((entry) => entry.id === intent.id)
      const folder = space.pinned[index]
      if (!folder || !isFolder(folder)) return false
      space.pinned.splice(index, 1, ...folder.rows)
      return true
    }
  }
}

function move(space: Space, id: Id, to: Place): boolean {
  if (to.before === id) return true
  const entry = take(space, id)
  if (!entry) return false

  const root = to.area === 'pinned' && to.folderId === null
  if (isFolder(entry) && !root) return false
  const list = listOf(space, to.area, to.area === 'pinned' ? to.folderId : null)
  return list !== undefined && insertAt(list, entry, to.before)
}

function remove(space: Space, id: Id): boolean {
  if (take(space, id)) return true

  return dropTab(space, id)
}

function updateTab(space: Space, tabId: Id, patch: Partial<Omit<Tab, 'id'>>): boolean {
  const tab = tabs(space).find((candidate) => candidate.id === tabId)
  if (!tab) return false
  Object.assign(tab, patch)
  return true
}

function navigate(space: Space, tabId: Id, side: 'local' | 'remote', path: string): boolean {
  const tab = findTab(space, tabId)
  if (!tab) return false
  if (isPinned(space, tabId)) return true
  if (side === 'local') {
    if (tab.target.kind === 'local') tab.target.cwd = path
  } else if (!path.startsWith('/')) return true
  else if (!tab.view) tab.remoteCwd = path
  else if (tab.view.kind === 'files') tab.view.path = path
  return true
}

function withFolder(space: Space, id: Id, change: (folder: Folder) => boolean): boolean {
  const folder = space.pinned.find((entry) => entry.id === id)
  return Boolean(folder && isFolder(folder) && change(folder))
}
