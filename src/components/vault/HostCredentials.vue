<script setup lang="ts">
import { computed } from 'vue'
import {
  choose,
  credentialOption,
  credentialUsername,
  inherited,
  optionId,
  parseOption,
  withUsername,
} from '@/domain/credentials'
import type { Effective, HostInput } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import CredentialSelect from './CredentialSelect.vue'
import { identityHint } from './inherit'
import SecretField from './SecretField.vue'
import UsernameField from './UsernameField.vue'
import VaultField from './VaultField.vue'

const props = defineProps<{ resolved: Effective }>()
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
const option = computed(() => credentialOption(draft.value.credential, Boolean(inheritance.value)))
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
const personal = computed(
  () =>
    !option.value ||
    option.value.kind === 'key' ||
    credentialUsername(draft.value.credential) !== null,
)
</script>

<template>
  <VaultField label="Identité" for="host-credential">
    <CredentialSelect id="host-credential" v-model="selection" :inherit="inheritance" />
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
