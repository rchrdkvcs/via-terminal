import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import SettingsPage from './SettingsPage.vue'

vi.mock('@/ipc/client', () => ({
  api: { saveSettings: vi.fn(async () => undefined) },
  describeError: String,
}))
vi.mock('@/lib/notify', () => ({ notify: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

function render() {
  return mount(SettingsPage, { attachTo: document.body })
}

describe('SettingsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useUi().route = 'settings'
  })

  it('returns to the workbench on Escape and on the close button', async () => {
    const page = render()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(useUi().route).toBe('workbench')

    useUi().route = 'settings'
    await page.get('[aria-label="Fermer les réglages"]').trigger('click')
    expect(useUi().route).toBe('workbench')
    page.unmount()
  })

  it('switches sections from the rail', async () => {
    const page = render()
    const shortcuts = page.findAll('nav button').find((b) => b.text().includes('Raccourcis'))
    await shortcuts?.trigger('click')
    expect(page.get('h2').text()).toBe('Raccourcis')
    expect(page.text()).toContain('Nouvel onglet')
    page.unmount()
  })

  it('asks for a second press before resetting', async () => {
    const settings = useSettings()
    settings.update({ fontSize: 20 })
    const page = render()
    const button = () => page.findAll('button').find((b) => /Rétablir|Confirmer/.test(b.text()))

    await button()?.trigger('click')
    expect(button()?.text()).toBe('Confirmer')
    expect(settings.settings.fontSize).toBe(20)

    await button()?.trigger('click')
    expect(settings.settings.fontSize).toBe(14)
    expect(button()?.text()).toBe('Rétablir les valeurs par défaut')
    page.unmount()
  })
})
