<script setup lang="ts">
import { computed } from 'vue'
import type { HostInput } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import IdSelect from './IdSelect.vue'
import { identityHint, inherited, type Inherited } from './inherit'
import SecretField from './SecretField.vue'
import { useVaultOptions } from './useVaultOptions'
import VaultField from './VaultField.vue'

const props = defineProps<{ resolved: Inherited }>()
const draft = defineModel<HostInput>({ required: true })
const emit = defineEmits<{ commit: [] }>()
const vault = useVault()
const options = useVaultOptions()

const inheritedIdentity = computed(() =>
  identityHint(vault.view, inherited(vault.view, draft.value.groupId).identityId),
)

const inheritedKey = computed(() => {
  const identityId = props.resolved.identityId?.value
  const identity = vault.view.identities.find((item) => item.id === identityId)
  const key = vault.view.keys.find((item) => item.id === identity?.keyId)
  return key && identity ? `Celle de l’identité ${identity.label} : ${key.label}` : 'Aucune'
})

function select(field: 'identity' | 'key', id: string | null) {
  if (field === 'identity') draft.value.overrides.identityId = id
  else draft.value.keyId = id
  emit('commit')
}
</script>

<template>
  <VaultField label="Identité" for="host-identity">
    <IdSelect
      id="host-identity"
      :model-value="draft.overrides.identityId"
      :options="options.identities.value"
      :none="inheritedIdentity"
      @update:model-value="select('identity', $event)"
    />
  </VaultField>
  <VaultField label="Clé" for="host-key">
    <IdSelect
      id="host-key"
      :model-value="draft.keyId"
      :options="options.keys.value"
      :none="inheritedKey"
      @update:model-value="select('key', $event)"
    />
  </VaultField>
  <SecretField
    :id="`host-password-${draft.id ?? 'new'}`"
    :key="draft.id ?? 'new'"
    v-model="draft.password"
    :stored="draft.id ? vault.hasPassword(draft.id) : false"
    :available="vault.view.secretsAvailable"
    @commit="emit('commit')"
  />
</template>
