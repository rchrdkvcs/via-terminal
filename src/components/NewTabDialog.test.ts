import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewTabDialog from './NewTabDialog.vue'

const store = reactive({
  newTabOpen: true,
  newTabType: 'local',
  activeWorkspaceId: 'workspace',
  activeWorkspace: { name: 'Personnel' },
  route: 'settings',
  createTerminal: vi.fn(),
  openTarget: vi.fn(),
  requestNodeDelete: vi.fn(),
})
vi.mock('@/stores/app', () => ({ useAppStore: () => store }))
vi.mock('@/ipc/client', () => ({ describeError: (error: unknown) => String(error) }))
vi.mock('@/components/new-tab/panels', () => ({
  tabPanels: {
    local: {
      icon: { template: '<span />' },
      panel: {
        name: 'LocalPicker',
        emits: ['open'],
        template:
          "<button @click=\"$emit('open', { kind: 'profile', id: 'profile' })\">Local</button>",
      },
    },
    ssh: {
      icon: { template: '<span />' },
      panel: {
        name: 'SshPicker',
        emits: ['open', 'configure', 'remove'],
        template: '<div />',
      },
    },
  },
}))

const slot = { template: '<div><slot /></div>' }
function render() {
  return mount(NewTabDialog, {
    global: {
      stubs: {
        Dialog: { name: 'PickerDialog', ...slot, props: ['open'], emits: ['update:open'] },
        DialogContent: slot,
        DialogHeader: slot,
        DialogTitle: slot,
        DialogDescription: slot,
        Tabs: slot,
        TabsList: slot,
        TabsTrigger: slot,
        TabsContent: slot,
      },
    },
  })
}

describe('new tab picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.newTabOpen = true
    store.newTabType = 'local'
    store.activeWorkspaceId = 'workspace'
    store.route = 'settings'
    store.createTerminal.mockResolvedValue({ id: 'tab' })
    store.openTarget.mockResolvedValue({ id: 'tab' })
  })

  it('opening and cancelling the picker starts no process', async () => {
    const wrapper = render()
    wrapper.findComponent({ name: 'PickerDialog' }).vm.$emit('update:open', false)
    await flushPromises()
    expect(store.newTabOpen).toBe(false)
    expect(store.createTerminal).not.toHaveBeenCalled()
    expect(store.openTarget).not.toHaveBeenCalled()
  })

  it('opens the chosen local profile and returns to the workspace', async () => {
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(store.createTerminal).toHaveBeenCalledWith('profile')
    expect(store.openTarget).not.toHaveBeenCalled()
    expect(store.route).toBe('workspace')
    expect(store.newTabOpen).toBe(false)
  })

  it('opens a saved SSH host as a new tab instead of focusing an existing one', async () => {
    const wrapper = render()
    wrapper.findComponent({ name: 'SshPicker' }).vm.$emit('open', { kind: 'resource', id: 'host' })
    await flushPromises()
    expect(store.openTarget).toHaveBeenCalledWith('resource', 'host', { reuse: false })
    expect(store.createTerminal).not.toHaveBeenCalled()
    expect(store.newTabOpen).toBe(false)
  })

  it('hands configuration to the SSH form after closing the picker', async () => {
    const wrapper = render()
    const request = { id: 'host', duplicate: true }
    wrapper.findComponent({ name: 'SshPicker' }).vm.$emit('configure', request)
    expect(store.newTabOpen).toBe(false)
    expect(wrapper.emitted('configure')).toEqual([[request]])
    expect(store.openTarget).not.toHaveBeenCalled()
  })

  it('keeps the picker open after a failed launch and prevents duplicate launches', async () => {
    let reject!: (error: string) => void
    store.createTerminal.mockReturnValue(
      new Promise((_, fail) => {
        reject = fail
      }),
    )
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('click')
    expect(store.createTerminal).toHaveBeenCalledOnce()
    wrapper.findComponent({ name: 'PickerDialog' }).vm.$emit('update:open', false)
    expect(store.newTabOpen).toBe(true)
    reject('Impossible de démarrer')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Impossible de démarrer')
    expect(store.newTabOpen).toBe(true)
  })
})
