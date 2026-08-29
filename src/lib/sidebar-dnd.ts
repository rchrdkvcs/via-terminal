export const SIDEBAR_DRAG_TYPE = 'application/x-terminarr-sidebar'

export type SidebarDrag =
  | { type: 'tab'; id: string }
  | { type: 'node'; id: string }
  | { type: 'favorite'; targetId: string }

export function writeSidebarDrag(event: DragEvent, value: SidebarDrag) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(SIDEBAR_DRAG_TYPE, JSON.stringify(value))
}

export function readSidebarDrag(event: DragEvent): SidebarDrag | null {
  const raw = event.dataTransfer?.getData(SIDEBAR_DRAG_TYPE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SidebarDrag
  } catch {
    return null
  }
}
