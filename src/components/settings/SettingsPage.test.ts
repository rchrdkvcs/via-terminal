import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
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

async function render() {
  const page = mount(SettingsPage, { attachTo: document.body })
  await flushPromises()
  return { page, body: new DOMWrapper(document.body) }
}

describe('SettingsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useUi().route = 'settings'
  })

  it('returns to the workbench on Escape and on the close button', async () => {
    let { page, body } = await render()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(useUi().route).toBe('workbench')
    page.unmount()

    useUi().route = 'settings'
    ;({ page, body } = await render())
    await body.get('[aria-label="Fermer les réglages"]').trigger('click')
    expect(useUi().route).toBe('workbench')
    page.unmount()
  })

  it('switches sections from the rail', async () => {
    const { page, body } = await render()
    const shortcuts = body.findAll('nav button').find((b) => b.text().includes('Raccourcis'))
    await shortcuts?.trigger('click')
    expect(body.get('h2').text()).toBe('Raccourcis')
    expect(body.get('[aria-current="page"]').text()).toContain('Raccourcis')
    expect(body.text()).toContain('Nouvel onglet')
    page.unmount()
  })

  it('asks for a second press before resetting', async () => {
    const settings = useSettings()
    settings.update({ fontSize: 20 })
    const { page, body } = await render()
    const button = () => body.findAll('button').find((b) => /Rétablir|Confirmer/.test(b.text()))

    await button()?.trigger('click')
    expect(button()?.text()).toBe('Confirmer')
    expect(settings.settings.fontSize).toBe(20)

    await button()?.trigger('click')
    expect(settings.settings.fontSize).toBe(14)
    expect(button()?.text()).toBe('Rétablir les valeurs par défaut')
    page.unmount()
  })
})
