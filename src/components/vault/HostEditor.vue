<script setup lang="ts">
import { Copy, Plug, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { effective } from '@/domain/credentials'
import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import { relativeTime } from './format'
import HostAddressFields from './HostAddressFields.vue'
import HostCredentials from './HostCredentials.vue'
import HostDetails from './HostDetails.vue'
import IconAction from './IconAction.vue'
import { hostInput, requireAddress } from './inputs'
import InspectorLayout from './InspectorLayout.vue'
import { useDraft } from './useDraft'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'

const props = defineProps<{ hostId: Id | null }>()
const vault = useVault()
const state = useVaultState()
const actions = useVaultActions()

const { draft, error, saving, commit, autosave } = useDraft({
  kind: 'host',
  source: () => hostInput(props.hostId ? vault.host(props.hostId) : undefined, state.scope.value),
  validate: requireAddress,
})

const host = computed(() => (props.hostId ? vault.host(props.hostId) : undefined))
const resolved = computed(() => effective(vault.view, draft.value))
const title = computed(() => draft.value.label || draft.value.address || 'Nouvel hôte')
const subtitle = computed(() => {
  if (!host.value) return 'Seule l’adresse est nécessaire.'
  const last = host.value.lastConnectedAt
  return last ? `Dernière connexion ${relativeTime(last)}` : 'Jamais connecté'
})

async function create(connect: boolean) {
  const id = await commit()
  if (!id) return
  state.selected.value = id
  if (connect) actions.connect(id)
}

function onKeydown(event: KeyboardEvent) {
  if (props.hostId || event.key !== 'Escape' || event.defaultPrevented) return
  event.preventDefault()
  state.creating.value = false
}
</script>

<template>
  <InspectorLayout :title="title" :subtitle="subtitle" :error="error" @keydown="onKeydown">
    <template v-if="host" #actions>
      <Button size="xs" class="me-1" @click="actions.connect(host.id)">
        <Plug :stroke-width="1.5" />
        Connecter
      </Button>
      <IconAction label="Dupliquer" @click="actions.duplicateHost(host.id)">
        <Copy :stroke-width="1.5" />
      </IconAction>
      <IconAction label="Supprimer" @click="actions.deleteHost(host.id)">
        <Trash2 :stroke-width="1.5" />
      </IconAction>
    </template>
    <HostAddressFields v-model="draft" :inherited="resolved" @commit="autosave" />
    <HostCredentials v-model="draft" :resolved="resolved" @commit="autosave" />
    <HostDetails v-model="draft" @commit="autosave" />
    <template v-if="!host" #footer>
      <Button variant="ghost" size="sm" @click="state.creating.value = false">Annuler</Button>
      <Button variant="outline" size="sm" :disabled="saving" @click="create(false)"
        >Enregistrer</Button
      >
      <Button size="sm" :disabled="saving" @click="create(true)">Enregistrer et connecter</Button>
    </template>
  </InspectorLayout>
</template>
