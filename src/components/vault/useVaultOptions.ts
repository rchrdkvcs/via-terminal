/** Choices offered by the inspector selects, and the group tree they derive from. */
import { computed } from 'vue'
import { useVault } from '@/stores/vault'
import type { Id } from '@/ipc/types'
import { buildTree, flatten } from './tree'

export interface Option {
  id: Id
  label: string
  /** Indentation level, for groups shown as a hierarchy. */
  depth?: number
}

export function useVaultOptions() {
  const vault = useVault()

  const tree = computed(() => buildTree(vault.view.groups, vault.view.hosts))

  const groups = computed<Option[]>(() =>
    flatten(tree.value).map((node) => ({
      id: node.group.id,
      label: node.group.name,
      depth: node.depth,
    })),
  )
  const identities = computed<Option[]>(() =>
    vault.view.identities.map((identity) => ({ id: identity.id, label: identity.label })),
  )
  const keys = computed<Option[]>(() =>
    vault.view.keys.map((key) => ({ id: key.id, label: key.label })),
  )

  return { tree, groups, identities, keys }
}
