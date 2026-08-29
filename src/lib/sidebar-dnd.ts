import { shallowRef } from 'vue'

export const SIDEBAR_DRAG_TYPE = 'application/x-terminarr-sidebar'

export type SidebarDrag =
  | { type: 'tab'; id: string }
  | { type: 'node'; id: string }
  | { type: 'favorite'; id: string; targetId: string }

/** Where a row accepts a drop: between two rows, or inside a folder. */
export type DropZone = 'before' | 'after' | 'into'

/**
 * A drag payload can only be read on `drop`, never during `dragover`, but the
 * sidebar must know what travels to decide which rows light up. The payload is
 * therefore also held here for the length of the gesture.
 */
export const activeDrag = shallowRef<SidebarDrag | null>(null)

/** Key of the single drop zone under the pointer, as `${rowId}:${zone}`. */
export const dropHint = shallowRef<string | null>(null)

export function startSidebarDrag(event: DragEvent, value: SidebarDrag) {
  activeDrag.value = value
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(SIDEBAR_DRAG_TYPE, JSON.stringify(value))
}

export function endSidebarDrag() {
  activeDrag.value = null
  dropHint.value = null
}

export function readSidebarDrag(event: DragEvent): SidebarDrag | null {
  const raw = event.dataTransfer?.getData(SIDEBAR_DRAG_TYPE)
  if (!raw) return activeDrag.value
  try {
    return JSON.parse(raw) as SidebarDrag
  } catch {
    return activeDrag.value
  }
}

/**
 * Split a row into hit zones. The two edges insert between rows; the middle of
 * a folder drops inside it. Rows are 32 px high, so the bands stay large enough
 * to aim at without a steady hand.
 */
export function rowZone(event: DragEvent, allowInto: boolean): DropZone {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0
  if (!allowInto) return ratio < 0.5 ? 'before' : 'after'
  return ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'into'
}

/** Marks the drop: a line on the edge crossed, or a ring around the folder. */
export const dropZoneClass: Record<DropZone, string> = {
  before: 'shadow-[inset_0_2px_0_0_var(--color-sidebar-ring)]',
  after: 'shadow-[inset_0_-2px_0_0_var(--color-sidebar-ring)]',
  into: 'ring-2 ring-sidebar-ring ring-inset',
}

export function acceptDrop(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}
