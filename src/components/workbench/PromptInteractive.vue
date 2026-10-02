<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Prompt, PromptAnswer } from '@/ipc/types'

/** Server challenges such as a one-time code. Answers are never stored. */
const props = defineProps<{ prompt: Extract<Prompt, { kind: 'keyboardInteractive' }> }>()
const emit = defineEmits<{ answer: [answer: PromptAnswer] }>()
const values = ref(props.prompt.fields.map(() => ''))
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="emit('answer', { kind: 'fields', values })">
    <h2 class="text-sm font-semibold">
      {{ prompt.name || 'Le serveur demande une vérification' }}
    </h2>
    <p v-if="prompt.instructions" class="text-[13px] whitespace-pre-line text-muted-foreground">
      {{ prompt.instructions }}
    </p>
    <label
      v-for="(field, index) in prompt.fields"
      :key="index"
      class="flex flex-col gap-1 text-[13px]"
    >
      <span class="text-muted-foreground">{{ field.label.trim().replace(/:$/, '') }}</span>
      <Input
        v-model="values[index]"
        :type="field.echo ? 'text' : 'password'"
        :autofocus="index === 0"
        autocomplete="one-time-code"
        @keydown.escape.prevent="emit('answer', { kind: 'cancel' })"
      />
    </label>
    <div class="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" @click="emit('answer', { kind: 'cancel' })"
        >Annuler</Button
      >
      <Button type="submit" size="sm">Envoyer</Button>
    </div>
  </form>
</template>
