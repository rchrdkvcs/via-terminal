import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'

export function useGroupTree() {
  const vault = useVault()
  const state = useVaultState()
  const actions = useVaultActions()

  /** Shows the hosts of a group, or of the whole vault. */
  function choose(id: Id | null) {
    state.scope.value = id
    state.selected.value = null
    state.creating.value = false
  }

  /** Opens the defaults a group passes on to its hosts. */
  function edit(id: Id) {
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
    edit(id)
    state.renaming.value = id
  }

  async function rename(id: Id, name: string | null) {
    state.renaming.value = null
    if (name) await actions.attempt(() => vault.renameGroup(id, name))
  }

  return { choose, edit, toggle, add, rename, remove: actions.deleteGroup }
}
