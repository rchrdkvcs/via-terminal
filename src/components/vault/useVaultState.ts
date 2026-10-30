import { computed, inject, provide, ref, type InjectionKey } from 'vue'
import { useHostName } from '@/composables/useHostName'
import type { Id } from '@/ipc/types'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'

export type Section = 'hosts' | 'identities' | 'keys' | 'knownHosts'
type Inspecting = 'host' | 'identity' | 'key' | 'new-host' | 'new-identity' | null

function createState() {
  const ui = useUi()
  const vault = useVault()

  const section = computed({
    get: () => ui.vaultFocus.section,
    set: (next: Section) => {
      ui.vaultFocus = { section: next, id: null }
      creating.value = false
    },
  })
  const selected = computed({
    get: () => ui.vaultFocus.id,
    set: (id: Id | null) => {
      ui.vaultFocus = { section: ui.vaultFocus.section, id }
      if (id) creating.value = false
    },
  })

  const creating = ref(false)

  const renaming = ref<Id | null>(null)

  const inspecting = computed<Inspecting>(() => {
    const id = selected.value
    switch (section.value) {
      case 'hosts':
        if (creating.value) return 'new-host'
        return id && vault.host(id) ? 'host' : null
      case 'identities':
        if (creating.value) return 'new-identity'
        return id && vault.view.identities.some((item) => item.id === id) ? 'identity' : null
      case 'keys':
        return id && vault.view.keys.some((item) => item.id === id) ? 'key' : null
      default:
        return null
    }
  })

  /** Leaves the opened item and returns to its list. */
  function back() {
    creating.value = false
    ui.vaultFocus = { section: ui.vaultFocus.section, id: null }
  }

  const hostName = useHostName()
  /** Name of the opened item, shown as the last breadcrumb. */
  const detail = computed(() => {
    const id = selected.value ?? ''
    switch (inspecting.value) {
      case 'host':
        return hostName(id)
      case 'new-host':
        return 'Nouvel hôte'
      case 'identity':
        return vault.view.identities.find((item) => item.id === id)?.label ?? 'Identité'
      case 'new-identity':
        return 'Nouvelle identité'
      case 'key':
        return vault.view.keys.find((item) => item.id === id)?.label ?? 'Clé'
      default:
        return null
    }
  })

  function startCreating() {
    ui.vaultFocus = { section: ui.vaultFocus.section, id: null }
    creating.value = true
  }

  return {
    section,
    selected,
    creating,
    renaming,
    inspecting,
    detail,
    back,
    startCreating,
  }
}

export type VaultState = ReturnType<typeof createState>

const key: InjectionKey<VaultState> = Symbol('vault-state')

export function provideVaultState(): VaultState {
  const state = createState()
  provide(key, state)
  return state
}

export function useVaultState(): VaultState {
  const state = inject(key)
  if (!state) throw new Error('useVaultState() needs <VaultView> as an ancestor')
  return state
}
