import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage.vue'

const store = reactive({
  route: 'settings',
  settingsSection: 'general',
  restoreDefaults: vi.fn(),
})

vi.mock('@/stores/app', () => ({ useAppStore: () => store }))

const passthrough = { template: '<div><slot /></div>' }

function renderPage() {
  return mount(SettingsPage, {
    global: {
      stubs: {
        Button: { template: '<button><slot /></button>' },
        AlertDialog: passthrough,
        AlertDialogContent: passthrough,
        AlertDialogHeader: passthrough,
        AlertDialogTitle: passthrough,
        AlertDialogDescription: passthrough,
        AlertDialogFooter: passthrough,
        AlertDialogCancel: { template: '<button><slot /></button>' },
        AlertDialogAction: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        GeneralSection: true,
        AppearanceSection: true,
        TerminalSection: true,
        KeybindingsSection: true,
        DataSection: true,
        AboutSection: true,
        ResourcesSection: true,
        Transition: passthrough,
      },
    },
  })
}

describe('SettingsPage', () => {
  beforeEach(() => {
    store.route = 'settings'
    store.settingsSection = 'general'
    store.restoreDefaults.mockClear()
  })

  it('navigue entre les sections et revient au terminal', async () => {
    const wrapper = renderPage()
    const buttons = wrapper.findAll('nav button')

    await buttons.find((button) => button.text().includes('Terminal'))!.trigger('click')
    expect(store.settingsSection).toBe('terminal')
    expect(wrapper.findComponent({ name: 'TerminalSection' }).exists()).toBe(true)

    await buttons.find((button) => button.text().includes('Retour au terminal'))!.trigger('click')
    expect(store.route).toBe('workspace')
  })

  it('transmet l’ajout de ressource et restaure la section active', async () => {
    const wrapper = renderPage()
    const resourcesButton = wrapper
      .findAll('nav button')
      .find((button) => button.text().includes('Ressources SSH'))!

    await resourcesButton.trigger('click')
    wrapper.findComponent({ name: 'ResourcesSection' }).vm.$emit('add')
    expect(wrapper.emitted('addResource')).toHaveLength(1)

    const restoreButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Rétablir')!
    await restoreButton.trigger('click')
    expect(store.restoreDefaults).toHaveBeenCalledWith('resources')
  })
})
