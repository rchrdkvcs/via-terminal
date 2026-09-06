import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspaceDeleteDialog from './WorkspaceDeleteDialog.vue'

const store = reactive({
  workspaces: [
    { id: 'personal', name: 'Personnel' },
    { id: 'work', name: 'Travail' },
  ],
  pendingWorkspaceDelete: 'work' as string | null,
  deleteWorkspace: vi.fn(),
})

vi.mock('@/stores/app', () => ({ useAppStore: () => store }))

describe('WorkspaceDeleteDialog', () => {
  beforeEach(() => {
    store.pendingWorkspaceDelete = 'work'
    store.deleteWorkspace.mockClear()
  })

  it('supprime l’espace confirmé lorsque le dialogue se ferme', async () => {
    const wrapper = mount(WorkspaceDeleteDialog, { attachTo: document.body })
    await wrapper.vm.$nextTick()
    const action = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Supprimer',
    )!

    action.click()
    await wrapper.vm.$nextTick()

    expect(store.deleteWorkspace).toHaveBeenCalledWith('work')
    wrapper.unmount()
  })
})
