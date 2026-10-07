import type { Id } from '@/ipc/types'
import { listOf } from './lists'
import type { Place } from './organize'
import { type Space, isFolder, locate } from './space'

export type DropPosition = 'before' | 'after' | 'into'

export function placeFor(space: Space, targetId: Id, position: DropPosition): Place | null {
  const location = locate(space, targetId)
  if (!location) return null
  const list = listOf(space, location.area, location.folderId)
  const target = list?.[location.index]
  if (!list || !target) return null
  if (position === 'into') {
    return isFolder(target) ? { area: 'pinned', folderId: target.id, before: null } : null
  }
  const before = position === 'before' ? target.id : (list[location.index + 1]?.id ?? null)
  return location.area === 'temporary'
    ? { area: 'temporary', before }
    : { area: 'pinned', folderId: location.folderId, before }
}
