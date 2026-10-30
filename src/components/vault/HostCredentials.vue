<script setup lang="ts">
import { computed } from 'vue'
import {
  choose,
  credentialOption,
  credentialUsername,
  optionId,
  parseOption,
  withUsername,
} from '@/domain/credentials'
import type { Effective, HostInput } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import CredentialSelect from './CredentialSelect.vue'
import SecretField from './SecretField.vue'
import UsernameField from './UsernameField.vue'
import VaultField from './VaultField.vue'

const props = defineProps<{ resolved: Effective }>()
const draft = defineModel<HostInput>({ required: true })
const emit = defineEmits<{ commit: [] }>()
const vault = useVault()
const option = computed(() => credentialOption(draft.value.credential))
const selection = computed({
  get: () => optionId(option.value),
  set: (id: string | null) => {
    const username = credentialUsername(draft.value.credential) ?? props.resolved.username?.value
    draft.value.credential = choose(parseOption(id), username ?? null)
    draft.value.password = { action: 'clear' }
    emit('commit')
  },
})
const username = computed({
  get: () => credentialUsername(draft.value.credential),
  set: (value: string | null) => {
    draft.value.credential = withUsername(draft.value.credential, value)
  },
})
function commitPersonal() {
  draft.value.credential = withUsername(draft.value.credential, username.value)
  emit('commit')
}
const explanation = computed(() => {
  switch (option.value?.kind) {
    case 'identity':
      return 'L’identité fournit l’utilisateur et sa clé ou son mot de passe.'
    case 'key':
      return 'Se connecte avec cette clé du coffre et l’utilisateur ci-dessous.'
    default:
      return 'Un utilisateur et un mot de passe propres à cet hôte.'
  }
})
const personal = computed(() => option.value?.kind !== 'identity')
</script>

<template>
  <VaultField label="Se connecter avec" for="host-credential" :hint="explanation">
    <CredentialSelect id="host-credential" v-model="selection" />
  </VaultField>
  <UsernameField
    v-if="personal"
    id="host-username"
    v-model="username"
    placeholder="Demandé à la connexion"
    @commit="commitPersonal"
  />
  <SecretField
    v-if="!option"
    :id="`host-password-${draft.id ?? 'new'}`"
    :key="draft.id ?? 'new'"
    v-model="draft.password"
    :stored="draft.id ? vault.hasPassword(draft.id) : false"
    :available="vault.view.secretsAvailable"
    @commit="commitPersonal"
  />
</template>
