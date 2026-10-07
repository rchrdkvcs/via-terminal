import { computed, inject, provide, reactive, ref, type InjectionKey } from 'vue'
import type { Id } from '@/ipc/types'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'

export type Section = 'hosts' | 'identities' | 'keys' | 'knownHosts'
export type Inspecting = 'host' | 'group' | 'identity' | 'key' | 'new-host' | 'new-identity' | null

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

  const scope = ref<Id | null>(null)
  const collapsed = reactive(new Set<Id>())

  const renaming = ref<Id | null>(null)

  const inspecting = computed<Inspecting>(() => {
    const id = selected.value
    switch (section.value) {
      case 'hosts':
        if (creating.value) return 'new-host'
        if (id && vault.host(id)) return 'host'
        return id && vault.group(id) ? 'group' : null
      case 'identities':
        if (creating.value) return 'new-identity'
        return id && vault.view.identities.some((item) => item.id === id) ? 'identity' : null
      case 'keys':
        return id && vault.view.keys.some((item) => item.id === id) ? 'key' : null
      default:
        return null
    }
  })

  function startCreating() {
    ui.vaultFocus = { section: ui.vaultFocus.section, id: null }
    creating.value = true
  }

  return { section, selected, creating, scope, collapsed, renaming, inspecting, startCreating }
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
  if (!state) throw new Error('useVaultState() needs <VaultPage> as an ancestor')
  return state
}
