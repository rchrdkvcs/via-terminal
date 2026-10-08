import { mount } from '@vue/test-utils'
import { h, nextTick, reactive } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import Inspector from '@/components/page/Inspector.vue'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import SidebarResizer from './SidebarResizer.vue'

const sidebar = reactive({ width: 264, visible: true })
vi.mock('@/stores/spaces', () => ({
  useSpaces: () => ({
    sidebar,
    setSidebar: (value: Partial<typeof sidebar>) => Object.assign(sidebar, value),
  }),
}))

beforeEach(() => {
  sidebar.width = 264
  sidebar.visible = true
  HTMLElement.prototype.setPointerCapture = vi.fn()
})

async function pointer(element: Element, type: string, clientX: number) {
  const event = new MouseEvent(type, { button: 0, clientX, bubbles: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  element.dispatchEvent(event)
  await nextTick()
}

it('preserves sidebar keyboard resizing and bounds without resetting on double click', async () => {
  const view = mount(SidebarResizer)
  const handle = view.get('[role="separator"]')
  await handle.trigger('keydown', { key: 'ArrowRight' })
  expect(sidebar.width).toBe(280)
  expect(handle.attributes('aria-valuenow')).toBe('280')
  sidebar.width = 200
  await handle.trigger('keydown', { key: 'ArrowLeft' })
  expect(sidebar.width).toBe(200)
  await handle.trigger('dblclick')
  expect(sidebar.width).toBe(200)
  view.unmount()
})

it('keeps pointer resizing and clears the active visual state when capture is lost', async () => {
  const view = mount(SidebarResizer)
  const handle = view.get('[role="separator"]')
  await pointer(handle.element, 'pointerdown', 264)
  await pointer(handle.element, 'pointermove', 320)
  expect(sidebar.width).toBe(320)
  expect(handle.attributes('data-dragging')).toBe('true')
  await handle.trigger('lostpointercapture')
  await pointer(handle.element, 'pointermove', 400)
  expect(sidebar.width).toBe(320)
  expect(handle.attributes('data-dragging')).toBe('false')
  view.unmount()
})

it('preserves inspector resizing from its left edge and exposes the current width', async () => {
  const view = mount(Inspector, { props: { label: 'Inspecteur' } })
  const handle = view.get('[role="separator"]')
  await handle.trigger('keydown', { key: 'ArrowLeft' })
  expect(handle.attributes('aria-valuenow')).toBe('404')
  await pointer(handle.element, 'pointerdown', 400)
  await pointer(handle.element, 'pointermove', 350)
  expect(handle.attributes('aria-valuenow')).toBe('454')
  await handle.trigger('pointerup')
  expect(handle.attributes('data-dragging')).toBe('false')
  await handle.trigger('dblclick')
  expect(handle.attributes('aria-valuenow')).toBe('454')
  view.unmount()
})

it.each(['horizontal', 'vertical'] as const)(
  'preserves Reka orientation, focus and keyboard resizing for a %s split',
  async (direction) => {
    const view = mount(ResizablePanelGroup, {
      props: { direction },
      slots: {
        default: () => [
          h(ResizablePanel, { defaultSize: 50, minSize: 20 }),
          h(ResizableHandle, { 'aria-label': 'Redimensionner les terminaux' }),
          h(ResizablePanel, { defaultSize: 50, minSize: 20 }),
        ],
      },
      attachTo: document.body,
    })
    await vi.waitFor(() =>
      expect(view.get('[role="separator"]').attributes('aria-valuenow')).toBe('50'),
    )
    const handle = view.get('[role="separator"]')
    expect(handle.attributes('data-orientation')).toBe(direction)
    expect(handle.attributes('tabindex')).toBe('0')
    expect(handle.find('[aria-hidden="true"]').exists()).toBe(true)
    await handle.trigger('keydown', {
      key: direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown',
    })
    await vi.waitFor(() => expect(Number(handle.attributes('aria-valuenow'))).toBeGreaterThan(50))
    view.unmount()
  },
)
