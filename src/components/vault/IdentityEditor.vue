<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/ipc/client'
import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import IconAction from './IconAction.vue'
import IdSelect from './IdSelect.vue'
import { identityInput, requireUsername } from './inputs'
import InspectorLayout from './InspectorLayout.vue'
import SecretField from './SecretField.vue'
import { useDraft } from './useDraft'
import { useVaultActions } from './useVaultActions'
import { useVaultOptions } from './useVaultOptions'
import { useVaultState } from './useVaultState'
import VaultField from './VaultField.vue'

/** A reusable username and credential, edited in place or drafted until saved. */
const props = defineProps<{ identityId: Id | null }>()
const vault = useVault()
const state = useVaultState()
const actions = useVaultActions()
const options = useVaultOptions()

const identity = computed(() => vault.view.identities.find((item) => item.id === props.identityId))
const { draft, error, saving, commit, autosave } = useDraft({
  kind: 'identity',
  source: () => identityInput(identity.value),
  save: (input) => vault.mutate(() => api.vault.saveIdentity(input)),
  validate: requireUsername,
})

const usage = computed(() => {
  const id = props.identityId
  const hosts = vault.view.hosts.filter((host) => host.overrides.identityId === id).length
  const groups = vault.view.groups.filter((group) => group.defaults.identityId === id).length
  if (!hosts && !groups) return 'Utilisée par aucun hôte ni groupe'
  const parts = [
    hosts && `${hosts} hôte${hosts > 1 ? 's' : ''}`,
    groups && `${groups} groupe${groups > 1 ? 's' : ''}`,
  ]
  return `Utilisée par ${parts.filter(Boolean).join(' et ')}`
})

function setKey(id: Id | null) {
  draft.value.keyId = id
  void autosave()
}

async function create() {
  const id = await commit()
  if (id) state.selected.value = id
}

function onKeydown(event: KeyboardEvent) {
  if (props.identityId || event.key !== 'Escape') return
  event.preventDefault()
  state.creating.value = false
}

const field = 'h-8 text-[13px] md:text-[13px]'
</script>

<template>
  <InspectorLayout
    :title="draft.label || draft.username || 'Nouvelle identité'"
    :subtitle="identity ? usage : 'Un nom d’utilisateur, et au choix une clé ou un mot de passe.'"
    :error="error"
    @keydown="onKeydown"
  >
    <template v-if="identity" #actions>
      <IconAction label="Supprimer l’identité" @click="actions.deleteIdentity(identity.id)">
        <Trash2 :stroke-width="1.5" />
      </IconAction>
    </template>
    <VaultField label="Libellé" for="identity-label">
      <Input
        id="identity-label"
        v-model="draft.label"
        :placeholder="draft.username || 'Admin production'"
        :class="field"
        @blur="autosave"
      />
    </VaultField>
    <VaultField label="Utilisateur" for="identity-username">
      <Input
        id="identity-username"
        v-model="draft.username"
        aria-required="true"
        placeholder="root"
        autocapitalize="off"
        spellcheck="false"
        :class="field"
        @blur="autosave"
      />
    </VaultField>
    <VaultField label="Clé" for="identity-key">
      <IdSelect
        id="identity-key"
        :model-value="draft.keyId"
        :options="options.keys.value"
        none="Aucune"
        @update:model-value="setKey"
      />
    </VaultField>
    <SecretField
      :id="`identity-password-${draft.id ?? 'new'}`"
      :key="draft.id ?? 'new'"
      v-model="draft.password"
      :stored="draft.id ? vault.hasPassword(draft.id) : false"
      :available="vault.view.secretsAvailable"
      @commit="autosave"
    />
    <template v-if="!identity" #footer>
      <Button variant="ghost" size="sm" @click="state.creating.value = false">Annuler</Button>
      <Button size="sm" :disabled="saving" @click="create">Enregistrer</Button>
    </template>
  </InspectorLayout>
</template>
