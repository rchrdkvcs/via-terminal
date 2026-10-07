import { computed } from 'vue'
import type { Id } from '@/ipc/types'
import { placeFor } from '@/domain/drop'
import { listOf } from '@/domain/lists'
import { locate } from '@/domain/space'
import type { Place } from '@/domain/organize'
import { useSpaces } from '@/stores/spaces'
import { dragging, hint } from './useRowDnd'

export function endTarget(area: 'pinned' | 'temporary', folderId: Id | null = null): Id {
  return folderId ? `end:pinned:${folderId}` : `end:${area}`
}

function endPlace(targetId: Id): Place | null {
  const [, area, folderId] = targetId.split(':')
  if (area === 'temporary') return { area, before: null }
  if (area === 'pinned') return { area, folderId: folderId ?? null, before: null }
  return null
}

export function useDropGap() {
  const spaces = useSpaces()

  const place = computed<Place | null>(() => {
    const current = hint.value
    if (!current || current.position === 'into') return null
    const target = current.targetId.startsWith('end:')
      ? endPlace(current.targetId)
      : placeFor(spaces.active, current.targetId, current.position)
    const source = dragging.value?.rowId
    if (!target || !source) return target

    const at = locate(spaces.active, source)
    const sameList =
      at &&
      at.area === target.area &&
      at.folderId === (target.area === 'pinned' ? target.folderId : null)
    if (!at || !sameList) return target
    const list = listOf(spaces.active, at.area, at.folderId) ?? []
    const next = list[at.index + 1]?.id ?? null
    return target.before === source || target.before === next ? null : target
  })

  function matches(area: 'pinned' | 'temporary', folderId: Id | null) {
    const target = place.value
    if (!target || target.area !== area) return null
    if (target.area === 'pinned' && target.folderId !== folderId) return null
    return target
  }

  return {
    lineBefore: (area: 'pinned' | 'temporary', folderId: Id | null, id: Id) =>
      matches(area, folderId)?.before === id,
    lineAtEnd: (area: 'pinned' | 'temporary', folderId: Id | null = null) =>
      matches(area, folderId)?.before === null,
  }
}
