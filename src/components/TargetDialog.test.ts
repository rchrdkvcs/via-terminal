import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TargetDialog from './TargetDialog.vue'

const store = reactive({
  activeWorkspaceId: 'workspace',
  workspaceResources: [
    {
      id: 'host',
      name: 'Production',
      host: 'example.test',
      sshAlias: null,
      port: 2222,
      identityId: 'identity',
    },
  ],
  workspaceIdentities: [
    { id: 'identity', name: 'Admin', username: 'admin', identityFile: '/keys/admin' },
  ],
  saveSshResource: vi.fn(),
  openTarget: vi.fn(),
})
vi.mock('@/stores/app', () => ({ useAppStore: () => store }))
vi.mock('@/ipc/client', () => ({
  isNative: () => false,
  describeError: (error: unknown) => String(error),
  api: {},
}))

const slot = { template: '<div><slot /></div>' }
function render(resourceId: string | null = null, duplicate = false) {
  return mount(TargetDialog, {
    props: { mode: 'resource', resourceId, duplicate },
    global: {
      stubs: {
        Dialog: slot,
        DialogContent: slot,
        DialogHeader: slot,
        DialogTitle: slot,
        DialogDescription: slot,
        DialogFooter: slot,
        Field: slot,
        FieldDescription: slot,
        FieldLabel: { template: '<label><slot /></label>' },
        Input: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Button: { template: '<button><slot /></button>' },
        Select: slot,
        SelectTrigger: slot,
        SelectValue: slot,
        SelectContent: slot,
        SelectItem: slot,
      },
    },
  })
}

describe('SSH connection form', () => {
  beforeEach(() => {
    store.saveSshResource.mockReset()
    store.openTarget.mockReset()
    store.saveSshResource.mockResolvedValue({ id: 'saved' })
  })

  it('edits the saved host while reusing its identity without opening a tab', async () => {
    const wrapper = render('host')
    await wrapper.get('#target-name').setValue('Renamed')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(store.saveSshResource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'host', name: 'Renamed', identityId: 'identity', port: 2222 }),
    )
    expect(store.openTarget).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('duplicates configuration with a new resource id', async () => {
    const wrapper = render('host', true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(store.saveSshResource).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, name: 'Production (copie)', identityId: 'identity' }),
    )
  })

  it('retains input and the open dialog after a save failure', async () => {
    store.saveSshResource.mockRejectedValue('Échec du stockage')
    const wrapper = render('host')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Échec du stockage')
    expect((wrapper.get('#target-name').element as HTMLInputElement).value).toBe('Production')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('refuses invalid ports and prevents duplicate submissions', async () => {
    const wrapper = render('host')
    await wrapper.get('#target-port').setValue('65536')
    await wrapper.get('form').trigger('submit')
    expect(store.saveSshResource).not.toHaveBeenCalled()
    await wrapper.get('#target-port').setValue('22')
    let resolve!: (value: { id: string }) => void
    store.saveSshResource.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(store.saveSshResource).toHaveBeenCalledTimes(1)
    resolve({ id: 'saved' })
    await flushPromises()
  })
})
