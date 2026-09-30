import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  paletteOpen: false,
  searchOpen: false,
  newTabOpen: false,
  route: 'workspace',
  activeTabId: null,
  workspaces: [],
  requestNewTab: vi.fn(),
}))

vi.mock('@/stores/app', () => ({ useAppStore: () => store }))

import { useShortcuts } from './useShortcuts'

const Host = defineComponent({
  setup() {
    useShortcuts()
  },
  template: '<input />',
})

describe('useShortcuts', () => {
  afterEach(() => {
    vi.clearAllMocks()
    store.paletteOpen = false
    store.newTabOpen = false
  })

  it('intercepte Ctrl T avant un terminal qui bloque la propagation', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const input = wrapper.get('input').element
    input.addEventListener('keydown', (event) => event.stopPropagation())

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true }))

    expect(store.requestNewTab).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('intercepte Ctrl K avant un terminal qui bloque la propagation', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const input = wrapper.get('input').element
    input.addEventListener('keydown', (event) => event.stopPropagation())

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))

    expect(store.paletteOpen).toBe(true)
    wrapper.unmount()
  })
  it('does not create or open another picker while a dialog has focus', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    store.newTabOpen = true
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(store.requestNewTab).not.toHaveBeenCalled()
    expect(store.paletteOpen).toBe(false)
    store.newTabOpen = false
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    document.body.append(dialog)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }))
    expect(store.requestNewTab).not.toHaveBeenCalled()
    dialog.remove()
    wrapper.unmount()
  })
})
