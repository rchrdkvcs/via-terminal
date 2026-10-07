import { api } from '@/ipc/client'
import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import { groupInput } from './inputs'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'

export function useGroupTree() {
  const vault = useVault()
  const state = useVaultState()
  const actions = useVaultActions()

  function choose(id: Id | null) {
    state.scope.value = id
    state.selected.value = id
  }

  function toggle(id: Id) {
    if (state.collapsed.has(id)) state.collapsed.delete(id)
    else state.collapsed.add(id)
  }

  async function add(parentId: Id | null) {
    const id = await actions.createGroup(parentId)
    if (!id) return
    if (parentId) state.collapsed.delete(parentId)
    choose(id)
    state.renaming.value = id
  }

  async function rename(id: Id, name: string | null) {
    state.renaming.value = null
    const group = vault.group(id)
    if (!name || !group) return
    await actions.run(() => api.vault.saveGroup({ ...groupInput(group), name }))
  }

  return { choose, toggle, add, rename, remove: actions.deleteGroup }
}
