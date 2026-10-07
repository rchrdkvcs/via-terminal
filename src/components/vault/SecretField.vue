<script setup lang="ts">
import { KeyRound } from '@lucide/vue'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SecretUpdate } from '@/ipc/types'
import VaultField from './VaultField.vue'

const props = defineProps<{ id: string; stored: boolean; available: boolean }>()
const emit = defineEmits<{ commit: [] }>()
const model = defineModel<SecretUpdate>({ required: true })
const text = ref('')
const replacing = ref(false)
const input = useTemplateRef<InstanceType<typeof Input>>('input')

watch(text, (value) => {
  model.value = value ? { action: 'set', value } : { action: 'keep' }
})

watch(model, (next) => {
  if (next.action === 'keep' && text.value) text.value = ''
  if (next.action === 'keep') replacing.value = false
})

function replace() {
  replacing.value = true
  void nextTick(() => (input.value?.$el as HTMLInputElement | undefined)?.focus())
}

function forget() {
  model.value = { action: 'clear' }
  emit('commit')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !replacing.value) return
  event.stopPropagation()
  text.value = ''
  replacing.value = false
}

const unavailable =
  'Aucun trousseau système n’est disponible : Via ne retient pas les mots de passe et les demandera à chaque connexion.'
</script>

<template>
  <VaultField label="Mot de passe" :for="id" :hint="available ? undefined : unavailable">
    <div
      v-if="available && props.stored && !replacing && model.action !== 'clear'"
      class="flex h-8 items-center gap-2"
    >
      <KeyRound
        class="text-muted-foreground size-3.5 shrink-0"
        :stroke-width="1.5"
        aria-hidden="true"
      />
      <span class="me-auto truncate text-[13px]">Mot de passe enregistré</span>
      <Button :id="id" variant="ghost" size="xs" @click="replace">Remplacer</Button>
      <Button variant="ghost" size="xs" @click="forget">Oublier</Button>
    </div>
    <Input
      v-else
      :id="id"
      ref="input"
      v-model="text"
      type="password"
      autocomplete="new-password"
      :disabled="!available"
      :placeholder="available ? 'Demandé à la connexion si vide' : 'Indisponible'"
      class="h-8 text-[13px] md:text-[13px]"
      @blur="emit('commit')"
      @keydown="onKeydown"
    />
  </VaultField>
</template>
