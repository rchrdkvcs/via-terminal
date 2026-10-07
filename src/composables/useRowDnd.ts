import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { Id } from '@/ipc/types'

export type { DropPosition } from '@/domain/drop'
import type { DropPosition } from '@/domain/drop'

export interface DragState {
  rowId: Id
  isFolder: boolean
}

export const dragging = ref<DragState | null>(null)
export const hint = ref<{ targetId: Id; position: DropPosition } | null>(null)

interface Options {
  id: () => Id
  isFolder?: boolean

  acceptsInto?: (source: DragState) => boolean
  canDrop?: (source: DragState) => boolean
  onDrop: (source: DragState, position: DropPosition) => void
}

const live = (element: Element) => !element.closest('[inert]')

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
          return live(el) && data.rowId !== options.id() && (options.canDrop?.(data) ?? true)
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

export function useDropZone(
  element: Ref<HTMLElement | undefined>,
  options: {
    target?: () => Id

    position?: DropPosition
    canDrop?: (source: DragState) => boolean
    onOver?: (source: DragState, input: { clientX: number; clientY: number }) => void
    onLeave?: () => void
    onDrop: (source: DragState, input: { clientX: number; clientY: number }) => void
  },
) {
  let dispose: (() => void) | undefined
  const leave = () => {
    if (options.target && hint.value?.targetId === options.target()) hint.value = null
    options.onLeave?.()
  }
  onMounted(() => {
    const el = element.value
    if (!el) return
    dispose = dropTargetForElements({
      element: el,
      canDrop: ({ source }) =>
        live(el) && (options.canDrop?.(source.data as unknown as DragState) ?? true),
      onDrag: ({ source, location }) => {
        if (options.target)
          hint.value = { targetId: options.target(), position: options.position ?? 'after' }
        options.onOver?.(source.data as unknown as DragState, location.current.input)
      },
      onDragLeave: leave,
      onDrop: ({ source, location }) => {
        leave()
        options.onDrop(source.data as unknown as DragState, location.current.input)
      },
    })
  })
  onBeforeUnmount(() => dispose?.())
}
