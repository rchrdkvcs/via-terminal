<script setup lang="ts">
import { computed } from 'vue'
import type { HostInput } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import CredentialSelect from './CredentialSelect.vue'
import { identityHint, inherited, type Inherited } from './inherit'
import SecretField from './SecretField.vue'
import UsernameField from './UsernameField.vue'
import VaultField from './VaultField.vue'

const props = defineProps<{ resolved: Inherited }>()
const draft = defineModel<HostInput>({ required: true })
const emit = defineEmits<{ commit: [] }>()
const vault = useVault()
const groupDefaults = computed(() => inherited(vault.view, draft.value.groupId))
const inheritance = computed(() =>
  groupDefaults.value.identityId
    ? identityHint(vault.view, groupDefaults.value.identityId)
    : groupDefaults.value.username
      ? `Hérité : ${groupDefaults.value.username.value}`
      : undefined,
)
const selection = computed({
  get: () =>
    draft.value.overrides.identityId
      ? `identity:${draft.value.overrides.identityId}`
      : draft.value.keyId
        ? `key:${draft.value.keyId}`
        : !draft.value.ownCredentials && !draft.value.overrides.username && inheritance.value
          ? 'inherit'
          : null,
  set: (choice: string | null) => {
    const previousUsername =
      draft.value.overrides.username ?? props.resolved.username?.value ?? null
    draft.value.overrides.identityId = choice?.startsWith('identity:') ? choice.slice(9) : null
    draft.value.keyId = choice?.startsWith('key:') ? choice.slice(4) : null
    draft.value.ownCredentials = choice !== 'inherit' && !draft.value.overrides.identityId
    draft.value.overrides.username = draft.value.ownCredentials ? previousUsername : null
    draft.value.password = { action: 'clear' }
    emit('commit')
  },
})
function commitPersonal() {
  draft.value.ownCredentials = true
  emit('commit')
}
const personal = computed(() => !selection.value || selection.value.startsWith('key:'))
</script>

<template>
  <VaultField label="Identité" for="host-credential">
    <CredentialSelect id="host-credential" v-model="selection" :inherit="inheritance" />
  </VaultField>
  <UsernameField
    v-if="personal"
    id="host-username"
    v-model="draft.overrides.username"
    placeholder="Demandé à la connexion"
    @commit="commitPersonal"
  />
  <SecretField
    v-if="!selection"
    :id="`host-password-${draft.id ?? 'new'}`"
    :key="draft.id ?? 'new'"
    v-model="draft.password"
    :stored="draft.id ? vault.hasPassword(draft.id) : false"
    :available="vault.view.secretsAvailable"
    @commit="commitPersonal"
  />
</template>
