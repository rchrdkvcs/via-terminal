/**
 * Pointer drag and drop of sidebar rows, on pragmatic-drag-and-drop.
 *
 * Rows only know how to describe themselves; the store decides what a drop
 * means by turning it into one `organize` intent. Nothing moves until the drop
 * is released on a valid target, and an invalid intent changes nothing.
 */
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { Id } from '@/ipc/types'

export type { DropPosition } from '@/domain/drop'
import type { DropPosition } from '@/domain/drop'

export interface DragState {
  rowId: Id
  isFolder: boolean
}

/** Shared across rows so every target can render the current hint. */
export const dragging = ref<DragState | null>(null)
export const hint = ref<{ targetId: Id; position: DropPosition } | null>(null)

interface Options {
  id: () => Id
  isFolder?: boolean
  /** Folders accept `into` in their middle band. */
  acceptsInto?: (source: DragState) => boolean
  canDrop?: (source: DragState) => boolean
  onDrop: (source: DragState, position: DropPosition) => void
}

function positionFor(element: Element, clientY: number, into: boolean): DropPosition {
  const rect = element.getBoundingClientRect()
  const ratio = (clientY - rect.top) / rect.height
  if (into && ratio > 0.25 && ratio < 0.75) return 'into'
  return ratio < 0.5 ? 'before' : 'after'
}

export function useRowDnd(element: Ref<HTMLElement | undefined>, options: Options) {
  let cleanup: Array<() => void> = []

  onMounted(() => {
    const el = element.value
    if (!el) return
    cleanup = [
      draggable({
        element: el,
        getInitialData: () => ({ rowId: options.id(), isFolder: Boolean(options.isFolder) }),
        onDragStart: () => {
          dragging.value = { rowId: options.id(), isFolder: Boolean(options.isFolder) }
        },
        onDrop: () => {
          dragging.value = null
          hint.value = null
        },
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
          const data = source.data as unknown as DragState
          return data.rowId !== options.id() && (options.canDrop?.(data) ?? true)
        },
        onDrag: ({ location, self, source }) => {
          const into = Boolean(options.acceptsInto?.(source.data as unknown as DragState))
          const position = positionFor(self.element, location.current.input.clientY, into)
          hint.value = { targetId: options.id(), position }
        },
        onDragLeave: () => {
          if (hint.value?.targetId === options.id()) hint.value = null
        },
        onDrop: ({ source, location, self }) => {
          const into = Boolean(options.acceptsInto?.(source.data as unknown as DragState))
          const position = positionFor(self.element, location.current.input.clientY, into)
          hint.value = null
          options.onDrop(source.data as unknown as DragState, position)
        },
      }),
    ]
  })

  onBeforeUnmount(() => cleanup.forEach((dispose) => dispose()))
}

/** A whole region (empty pinned area, temporary area end, content edges). */
export function useDropZone(
  element: Ref<HTMLElement | undefined>,
  options: {
    canDrop?: (source: DragState) => boolean
    onOver?: (source: DragState, input: { clientX: number; clientY: number }) => void
    onLeave?: () => void
    onDrop: (source: DragState, input: { clientX: number; clientY: number }) => void
  },
) {
  let dispose: (() => void) | undefined
  onMounted(() => {
    if (!element.value) return
    dispose = dropTargetForElements({
      element: element.value,
      canDrop: ({ source }) => options.canDrop?.(source.data as unknown as DragState) ?? true,
      onDrag: ({ source, location }) =>
        options.onOver?.(source.data as unknown as DragState, location.current.input),
      onDragLeave: () => options.onLeave?.(),
      onDrop: ({ source, location }) => {
        options.onLeave?.()
        options.onDrop(source.data as unknown as DragState, location.current.input)
      },
    })
  })
  onBeforeUnmount(() => dispose?.())
}
