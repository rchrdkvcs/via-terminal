import type { Entry, Folder, Id, Row } from '@/ipc/types'
import { type Area, type Space, isFolder, locate } from './space'

export function listOf(space: Space, area: Area, folderId: Id | null): Entry[] | undefined {
  if (area === 'temporary') return space.temporary
  if (folderId === null) return space.pinned
  const folder = space.pinned.find((entry) => entry.id === folderId)
  return folder && isFolder(folder) ? folder.rows : undefined
}

export function slot(space: Space, id: Id): { list: Entry[]; index: number } | undefined {
  const location = locate(space, id)
  const list = location && listOf(space, location.area, location.folderId)
  return list && location ? { list, index: location.index } : undefined
}

export function insertAt<T extends { id: Id }>(list: T[], item: T, before: Id | null): boolean {
  if (before === null) {
    list.push(item)
    return true
  }
  const index = list.findIndex((entry) => entry.id === before)
  if (index < 0) return false
  list.splice(index, 0, item)
  return true
}

export function take(space: Space, id: Id): Row | Folder | undefined {
  const at = slot(space, id)
  return at?.list.splice(at.index, 1)[0]
}
