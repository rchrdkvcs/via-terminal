<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { Prompt, PromptAnswer } from '@/ipc/types'

type SecretPrompt = Extract<Prompt, { kind: 'username' | 'password' | 'passphrase' }>

/** Username, password or key passphrase, typed in the pane, never in the terminal. */
const props = defineProps<{ prompt: SecretPrompt }>()
const emit = defineEmits<{ answer: [answer: PromptAnswer] }>()
const value = ref('')
const remember = ref(false)
const input = ref<InstanceType<typeof Input>>()

const copy = computed(() => {
  const prompt = props.prompt
  if (prompt.kind === 'username')
    return {
      title: `Utilisateur pour ${prompt.address}`,
      label: 'Nom d’utilisateur',
      secret: false,
    }
  if (prompt.kind === 'password')
    return {
      title: `Mot de passe de ${prompt.username}@${prompt.address}`,
      label: 'Mot de passe',
      secret: true,
    }
  return {
    title: `Phrase de passe de la clé « ${prompt.keyLabel} »`,
    label: 'Phrase de passe',
    secret: true,
  }
})
const retry = computed(() => props.prompt.kind !== 'username' && props.prompt.retry)
const canRemember = computed(() => props.prompt.kind !== 'username' && props.prompt.canRemember)

function submit() {
  if (!value.value && props.prompt.kind === 'username') return
  emit('answer', { kind: 'text', value: value.value, remember: remember.value })
}

onMounted(() => (input.value?.$el as HTMLInputElement | undefined)?.focus())
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="submit">
    <h2 class="text-sm font-semibold">{{ copy.title }}</h2>
    <p v-if="retry" role="alert" class="text-[13px] text-destructive">
      Refusé par le serveur. Réessayez.
    </p>
    <Input
      ref="input"
      v-model="value"
      :type="copy.secret ? 'password' : 'text'"
      :aria-label="copy.label"
      :placeholder="copy.label"
      autocomplete="off"
      spellcheck="false"
      @keydown.escape.prevent="emit('answer', { kind: 'cancel' })"
    />
    <label v-if="canRemember" class="flex items-center gap-2 text-[13px] text-muted-foreground">
      <Switch v-model="remember" /> Mémoriser dans le coffre
    </label>
    <div class="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" @click="emit('answer', { kind: 'cancel' })"
        >Annuler</Button
      >
      <Button type="submit" size="sm">Continuer</Button>
    </div>
  </form>
</template>
