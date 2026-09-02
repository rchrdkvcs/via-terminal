import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  paletteOpen: false,
  searchOpen: false,
  route: 'workspace',
  activeTabId: null,
  workspaces: [],
  createTerminal: vi.fn(),
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
  })

  it('intercepte Ctrl T avant un terminal qui bloque la propagation', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const input = wrapper.get('input').element
    input.addEventListener('keydown', (event) => event.stopPropagation())

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true }))

    expect(store.createTerminal).toHaveBeenCalledOnce()
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
})
