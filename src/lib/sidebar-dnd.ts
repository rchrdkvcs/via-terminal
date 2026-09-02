import { shallowRef } from 'vue'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'

export type SidebarDrag =
  | { type: 'tab'; id: string }
  | { type: 'node'; id: string }
  | { type: 'favorite'; id: string; targetId: string }

export type DropZone = 'before' | 'after' | 'into'

export const activeDrag = shallowRef<SidebarDrag | null>(null)
export const dropHint = shallowRef<string | null>(null)
let dropHintOwner: string | null = null

export function setDropHint(owner: string, hint: string) {
  dropHintOwner = owner
  dropHint.value = hint
}

export function clearDropHint(owner?: string) {
  if (owner && owner !== dropHintOwner) return
  dropHintOwner = null
  dropHint.value = null
}

function isSidebarDrag(value: Record<string, unknown>): value is SidebarDrag {
  return (
    typeof value.id === 'string' &&
    (value.type === 'tab' || value.type === 'node' || value.type === 'favorite')
  )
}

export function registerSidebarDrag(
  element: HTMLElement,
  value: SidebarDrag,
  options: { onStart?: () => void; onFinish?: () => void } = {},
) {
  return draggable({
    element,
    getInitialData: () => value,
    onDragStart: () => {
      activeDrag.value = value
      options.onStart?.()
    },
    onDrop: () => {
      endSidebarDrag()
      options.onFinish?.()
    },
  })
}

export function registerSidebarDrop(
  element: HTMLElement,
  handlers: {
    canDrop?: (drag: SidebarDrag) => boolean
    onMove?: (drag: SidebarDrag, input: { clientX: number; clientY: number }) => void
    onLeave?: () => void
    onDrop: (drag: SidebarDrag, input: { clientX: number; clientY: number }) => void
  },
) {
  return dropTargetForElements({
    element,
    canDrop: ({ source }) =>
      isSidebarDrag(source.data) && (handlers.canDrop?.(source.data) ?? true),
    getData: () => ({ sidebarTarget: true }),
    onDrag: ({ source, location }) => {
      if (!isSidebarDrag(source.data)) return
      if (location.current.dropTargets[0]?.element !== element) return
      handlers.onMove?.(source.data, location.current.input)
    },
    onDragLeave: handlers.onLeave,
    onDrop: ({ source, location }) => {
      if (!isSidebarDrag(source.data)) return
      if (location.current.dropTargets[0]?.element !== element) return
      handlers.onDrop(source.data, location.current.input)
    },
  })
}

export function registerSidebarDragAndDrop(
  element: HTMLElement,
  value: SidebarDrag,
  handlers: Parameters<typeof registerSidebarDrop>[1],
) {
  return combine(registerSidebarDrag(element, value), registerSidebarDrop(element, handlers))
}

export function endSidebarDrag() {
  activeDrag.value = null
  clearDropHint()
}

export function rowZone(
  input: { clientY: number },
  element: HTMLElement,
  allowInto: boolean,
): DropZone {
  const rect = element.getBoundingClientRect()
  const ratio = rect.height > 0 ? (input.clientY - rect.top) / rect.height : 0
  if (!allowInto) return ratio < 0.5 ? 'before' : 'after'
  return ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'into'
}

export const dropZoneClass: Record<DropZone, string> = {
  before: 'shadow-[inset_0_2px_0_0_var(--color-sidebar-ring)]',
  after: 'shadow-[inset_0_-2px_0_0_var(--color-sidebar-ring)]',
  into: 'bg-sidebar-ring/30',
}
