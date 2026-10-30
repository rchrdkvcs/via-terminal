import { computed } from 'vue'
import { useVault } from '@/stores/vault'
import type { Id } from '@/ipc/types'

export interface Option {
  id: Id
  label: string
}

export function useVaultOptions() {
  const vault = useVault()

  const identities = computed<Option[]>(() =>
    vault.view.identities.map((identity) => ({ id: identity.id, label: identity.label })),
  )
  const keys = computed<Option[]>(() =>
    vault.view.keys.map((key) => ({ id: key.id, label: key.label })),
  )

  return { identities, keys }
}
