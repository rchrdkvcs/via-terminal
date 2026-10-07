<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import CredentialSelect from '@/components/vault/CredentialSelect.vue'
import { parseOption } from '@/domain/credentials'
import type { Prompt, PromptAnswer } from '@/ipc/types'

type SecretPrompt = Extract<
  Prompt,
  { kind: 'authentication' | 'username' | 'password' | 'passphrase' }
>

const props = defineProps<{ prompt: SecretPrompt }>()
const emit = defineEmits<{ answer: [answer: PromptAnswer] }>()
const credentialId = useId()
const value = ref('')
const credential = ref<string | null>(null)
const username = ref('username' in props.prompt ? (props.prompt.username ?? '') : '')
const remember = ref(false)
const input = ref<InstanceType<typeof Input>>()
const usernameInput = ref<InstanceType<typeof Input>>()

const copy = computed(() => {
  const prompt = props.prompt
  if (prompt.kind === 'authentication')
    return { title: `Identité pour ${prompt.address}`, label: 'Mot de passe', secret: true }
  if (prompt.kind === 'username')
    return {
      title: `Utilisateur pour ${prompt.address}`,
      label: 'Nom d’utilisateur',
      secret: false,
    }
  if (prompt.kind === 'password')
    return {
      title: `Connexion à ${prompt.username}@${prompt.address}`,
      label: 'Mot de passe',
      secret: true,
    }
  return {
    title: `Phrase de passe de la clé « ${prompt.keyLabel} »`,
    label: 'Phrase de passe',
    secret: true,
  }
})
const retry = computed(() => 'retry' in props.prompt && props.prompt.retry)
const canRemember = computed(() => 'canRemember' in props.prompt && props.prompt.canRemember)

function submit() {
  const option = parseOption(credential.value)
  if (option?.kind === 'identity') {
    emit('answer', { kind: 'credential', credential: option })
    return
  }
  if (option?.kind === 'key') {
    if (!username.value.trim()) return
    const choice = { kind: 'key', id: option.id, username: username.value.trim() } as const
    emit('answer', { kind: 'credential', credential: choice })
    return
  }
  if (props.prompt.kind === 'authentication') {
    if (!username.value.trim()) return
    emit('answer', {
      kind: 'authentication',
      username: username.value.trim(),
      password: value.value,
      remember: remember.value,
    })
    return
  }
  if (!value.value && props.prompt.kind === 'username') return
  emit('answer', { kind: 'text', value: value.value, remember: remember.value })
}

onMounted(() =>
  ((usernameInput.value ?? input.value)?.$el as HTMLInputElement | undefined)?.focus(),
)
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="submit">
    <h2 class="text-[15px] font-semibold tracking-[-0.01em]">{{ copy.title }}</h2>
    <p v-if="retry" role="alert" class="text-[13px] text-destructive">
      Refusé par le serveur. Réessayez.
    </p>
    <template v-if="prompt.kind !== 'passphrase'">
      <label :for="credentialId" class="text-[13px]">Identité</label>
      <CredentialSelect :id="credentialId" v-model="credential" />
      <Input
        v-if="
          parseOption(credential)?.kind === 'key' ||
          (!credential && prompt.kind === 'authentication')
        "
        ref="usernameInput"
        v-model="username"
        aria-label="Nom d’utilisateur"
        placeholder="Nom d’utilisateur"
        autocomplete="off"
        spellcheck="false"
      />
    </template>
    <Input
      v-if="!credential"
      ref="input"
      v-model="value"
      :type="copy.secret ? 'password' : 'text'"
      :aria-label="copy.label"
      :placeholder="copy.label"
      autocomplete="off"
      spellcheck="false"
      @keydown.escape.prevent="emit('answer', { kind: 'cancel' })"
    />
    <label
      v-if="canRemember && !credential"
      class="flex items-center gap-2 text-[13px] text-muted-foreground"
    >
      <Switch v-model="remember" /> Mémoriser dans le coffre
    </label>
    <div class="flex justify-end gap-2">
      <Button type="button" variant="secondary" @click="emit('answer', { kind: 'cancel' })"
        >Annuler</Button
      >
      <Button type="submit">Continuer</Button>
    </div>
  </form>
</template>
