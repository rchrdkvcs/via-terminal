import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import ShortcutsSection from './ShortcutsSection.vue'

vi.mock('@/ipc/client', () => ({
  api: { saveSettings: vi.fn(async () => undefined) },
  describeError: String,
}))
vi.mock('@/lib/notify', () => ({ notify: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const key = (code: string, init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...init }))

function render() {
  const settings = useSettings()
  settings.platform = 'macos'
  const view = mount(ShortcutsSection, { attachTo: document.body })
  const row = () => view.get('button[aria-labelledby="shortcut-closeTab"]')
  return { view, settings, row }
}

describe('ShortcutsSection', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('records a new combination and restores the default', async () => {
    const { view, settings, row } = render()
    await row().trigger('click')
    expect(useUi().recordingShortcut).toBe(true)

    key('KeyW', { key: 'w', metaKey: true, altKey: true })
    await view.vm.$nextTick()
    expect(settings.settings.keybindings.closeTab).toEqual(['Alt', 'Cmd', 'W'])
    expect(useUi().recordingShortcut).toBe(false)
    expect(row().text()).toContain('⌥')

    await view.get('[aria-label^="Rétablir le raccourci par défaut"]').trigger('click')
    expect(settings.settings.keybindings).toEqual({})
    view.unmount()
  })

  it('explains a clash and keeps listening, and Escape cancels', async () => {
    const { view, settings, row } = render()
    await row().trigger('click')
    key('KeyT', { key: 't', metaKey: true })
    await view.vm.$nextTick()
    expect(view.get('[role="alert"]').text()).toContain('Nouvel onglet')
    expect(useUi().recordingShortcut).toBe(true)

    key('Escape', { key: 'Escape' })
    await view.vm.$nextTick()
    expect(useUi().recordingShortcut).toBe(false)
    expect(settings.settings.keybindings).toEqual({})
    view.unmount()
  })
})
