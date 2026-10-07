import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { row, setup } from '@/stores/workbench.fixture'
import type { Row } from '@/ipc/types'
import { useSidebarActions } from './useSidebarActions'
import { useDropGap } from './useDropGap'
import { dragging, hint, useRowDnd, type DragState } from './useRowDnd'

interface Input {
  clientX: number
  clientY: number
}
interface Source {
  data: DragState
}
interface Target {
  canDrop(args: { source: Source }): boolean
  onDrag(args: { source: Source; self: { element: Element }; location: unknown }): void
  onDragLeave(): void
  onDrop(args: { source: Source; self: { element: Element }; location: unknown }): void
}
interface Draggable {
  getInitialData(): DragState
  onDragStart(): void
  onDrop(): void
}

const adapter = vi.hoisted(() => ({
  draggables: new Map<Element, unknown>(),
  targets: new Map<Element, unknown>(),
}))
vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: (config: { element: Element }) => {
    adapter.draggables.set(config.element, config)
    return () => adapter.draggables.delete(config.element)
  },
  dropTargetForElements: (config: { element: Element }) => {
    adapter.targets.set(config.element, config)
    return () => adapter.targets.delete(config.element)
  },
}))

enableAutoUnmount(afterEach)

/** Rows of the active space laid out 20px tall, each wired the way the sidebar wires them. */
function sidebar(ids: string[], folders: string[] = []) {
  const actions = useSidebarActions()
  const elements = new Map<string, HTMLElement>()
  const Row = defineComponent({
    props: { id: { type: String, required: true }, top: { type: Number, required: true } },
    setup(props) {
      const element = ref<HTMLElement>()
      const isFolder = folders.includes(props.id)
      useRowDnd(element, {
        id: () => props.id,
        isFolder,
        acceptsInto: (source) => isFolder && !source.isFolder,
        onDrop: (source, position) => actions.dropOnRow(source.rowId, props.id, position),
      })
      return () =>
        h('div', {
          ref: (el) => {
            if (!el) return
            element.value = el as HTMLElement
            elements.set(props.id, el as HTMLElement)
            element.value.getBoundingClientRect = () => ({ top: props.top, height: 20 }) as DOMRect
          },
        })
    },
  })
  const wrapper = mount(
    defineComponent({
      setup: () => () => ids.map((id, index) => h(Row, { id, top: index * 20, key: id })),
    }),
  )
  const at = (id: string) => elements.get(id)!
  const target = (id: string) => adapter.targets.get(at(id)) as Target
  const handle = (id: string) => adapter.draggables.get(at(id)) as Draggable

  /** Drags `id` over rows, `y` pixels below their top; `over` tells whether the row accepts it. */
  function drag(id: string) {
    const drag = handle(id)
    const source = { data: drag.getInitialData() }
    drag.onDragStart()
    const location = (targetId: string, y: number) => ({
      current: {
        input: { clientX: 0, clientY: at(targetId).getBoundingClientRect().top + y } as Input,
      },
    })
    return {
      over(targetId: string, y: number) {
        const over = target(targetId)
        if (!over.canDrop({ source })) return false
        over.onDrag({ source, self: { element: at(targetId) }, location: location(targetId, y) })
        return true
      },
      leave(targetId: string) {
        target(targetId).onDragLeave()
      },
      cancel() {
        drag.onDrop()
      },
      drop(targetId: string, y: number) {
        target(targetId).onDrop({
          source,
          self: { element: at(targetId) },
          location: location(targetId, y),
        })
        drag.onDrop()
      },
    }
  }
  return { wrapper, drag, at }
}

const order = (list: { id: string }[]) => list.map((entry) => entry.id)
const folder = (id: string): Row =>
  ({ kind: 'folder', id, name: id, open: true, rows: [] }) as unknown as Row

describe('row drag and drop', () => {
  it('reads the drop position from the pointer and moves the row there', () => {
    const { spaces } = setup([], [row('a'), row('b'), row('c')])
    const { drag } = sidebar(['a', 'b', 'c'])

    const moving = drag('c')
    expect(dragging.value).toEqual({ rowId: 'c', isFolder: false })
    expect(moving.over('a', 4)).toBe(true)
    expect(hint.value).toEqual({ targetId: 'a', position: 'before' })
    moving.over('a', 16)
    expect(hint.value).toEqual({ targetId: 'a', position: 'after' })
    moving.drop('a', 4)
    expect(order(spaces.active.temporary)).toEqual(['c', 'a', 'b'])
    expect(dragging.value).toBeNull()
    expect(hint.value).toBeNull()
  })

  it('never drops a row on itself nor on an inert row', () => {
    setup([], [row('a'), row('b')])
    const { drag, at } = sidebar(['a', 'b'])
    const moving = drag('a')
    expect(moving.over('a', 4)).toBe(false)
    at('b').setAttribute('inert', '')
    expect(moving.over('b', 4)).toBe(false)
    moving.cancel()
    expect(dragging.value).toBeNull()
  })

  it('drops into a folder through its middle, and leaving clears the hint', () => {
    const { spaces } = setup([folder('f')], [row('a')])
    const { drag } = sidebar(['f', 'a'], ['f'])
    const moving = drag('a')
    moving.over('f', 10)
    expect(hint.value).toEqual({ targetId: 'f', position: 'into' })
    moving.leave('f')
    expect(hint.value).toBeNull()
    moving.drop('f', 10)
    const inside = spaces.active.pinned[0]
    expect(inside.kind === 'folder' && order(inside.rows)).toEqual(['a'])
  })

  it('shows a drop line only where the row would actually move', () => {
    setup([], [row('a'), row('b'), row('c')])
    const { drag } = sidebar(['a', 'b', 'c'])
    const gap = useDropGap()
    const moving = drag('a')

    moving.over('b', 4)
    expect(gap.lineBefore('temporary', null, 'b')).toBe(false)
    moving.over('b', 16)
    expect(gap.lineBefore('temporary', null, 'c')).toBe(true)
    moving.over('c', 16)
    expect(gap.lineAtEnd('temporary')).toBe(true)
    expect(gap.lineAtEnd('pinned')).toBe(false)
    moving.drop('c', 16)
  })

  it('stops listening once the row is gone', () => {
    setup([], [row('a')])
    const { wrapper } = sidebar(['a'])
    expect(adapter.targets.size).toBe(1)
    wrapper.unmount()
    expect(adapter.targets.size).toBe(0)
    expect(adapter.draggables.size).toBe(0)
  })
})
