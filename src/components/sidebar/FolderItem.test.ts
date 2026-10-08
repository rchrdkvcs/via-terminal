import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import FolderItem from './FolderItem.vue'

const { ui, dispatch } = vi.hoisted(() => ({
  ui: { renaming: null as string | null },
  dispatch: vi.fn(),
}))
vi.mock('@/stores/ui', () => ({ useUi: () => reactive(ui) }))
vi.mock('@/stores/spaces', () => ({ useSpaces: () => ({ dispatch }) }))
vi.mock('@/composables/useSidebarActions', () => ({ useSidebarActions: () => ({}) }))
vi.mock('@/composables/useRowDnd', () => ({ useRowDnd: () => {}, dragging: null, hint: {} }))

let wrapper: ReturnType<typeof mount>
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  ui.renaming = null
  vi.clearAllMocks()
})

it.each(['context menu', 'F2'])('focuses and selects the rename input via %s', async (source) => {
  wrapper = mount(FolderItem, {
    attachTo: document.body,
    props: { folder: { kind: 'folder', id: 'folder', name: 'Production', open: true, rows: [] } },
    global: { stubs: { RowArea: true } },
  })
  const row = wrapper.get('[role="button"]')
  ;(row.element as HTMLElement).focus()
  if (source === 'context menu') {
    await row.trigger('contextmenu', { button: 2 })
    await flushPromises()
    const rename = document.querySelector('[role="menuitem"]') as HTMLElement
    expect(rename.textContent).toContain('Renommer')
    rename.click()
  } else {
    await row.trigger('keydown', { key: 'F2' })
  }
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 50))
  await nextTick()
  const input = wrapper.find('input')
  expect(input.exists()).toBe(true)
  expect(document.activeElement).toBe(input.element)
  expect((input.element as HTMLInputElement).selectionStart).toBe(0)
  expect((input.element as HTMLInputElement).selectionEnd).toBe('Production'.length)
  expect(dispatch).not.toHaveBeenCalled()
  await input.setValue('Staging')
  await input.trigger('keydown', { key: 'Enter' })
  expect(dispatch).toHaveBeenCalledExactlyOnceWith({
    type: 'renameFolder',
    id: 'folder',
    name: 'Staging',
  })
  expect(wrapper.find('input').exists()).toBe(false)
})
