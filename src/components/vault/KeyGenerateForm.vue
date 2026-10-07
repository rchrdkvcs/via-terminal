<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Id } from '@/ipc/types'
import { useKeyActions } from './useKeyActions'

const emit = defineEmits<{ done: [id: Id | null] }>()
const keys = useKeyActions()
const label = ref('')
const busy = ref(false)
const input = useTemplateRef<InstanceType<typeof Input>>('input')

onMounted(() => (input.value?.$el as HTMLInputElement | undefined)?.focus())

async function submit() {
  busy.value = true
  const id = await keys.generate(label.value.trim() || 'Clé Ed25519')
  busy.value = false
  if (id) emit('done', id)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  emit('done', null)
}
</script>

<template>
  <form
    class="bg-row-hover mx-2 mb-2 flex items-center gap-2 rounded-lg p-2"
    @submit.prevent="submit"
    @keydown="onKeydown"
  >
    <label for="key-generate-label" class="sr-only">Libellé de la nouvelle clé</label>
    <Input
      id="key-generate-label"
      ref="input"
      v-model="label"
      placeholder="Libellé, par exemple Portable perso"
      class="h-8 flex-1 text-[13px] md:text-[13px]"
    />
    <Button type="button" variant="ghost" size="sm" @click="emit('done', null)">Annuler</Button>
    <Button type="submit" size="sm" :disabled="busy">Générer</Button>
  </form>
</template>
