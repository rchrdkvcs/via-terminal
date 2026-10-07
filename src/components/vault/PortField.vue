<script setup lang="ts">
import { ref, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { parsePort } from './format'
import VaultField from './VaultField.vue'

defineProps<{ id: string; placeholder: string }>()
const model = defineModel<number | null>({ required: true })
const emit = defineEmits<{ commit: [] }>()
const text = ref('')
const error = ref<string | null>(null)

watch(model, (value) => (text.value = value ? String(value) : ''), { immediate: true })

function commit() {
  const value = parsePort(text.value)
  error.value = value === undefined ? 'Le port est un nombre entre 1 et 65535.' : null
  if (value === undefined) return
  model.value = value
  emit('commit')
}
</script>

<template>
  <VaultField label="Port" :for="id">
    <Input
      :id="id"
      v-model="text"
      inputmode="numeric"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
      :placeholder="placeholder"
      class="h-8 text-[13px] md:text-[13px]"
      @blur="commit"
    />
    <p v-if="error" :id="`${id}-error`" class="text-destructive text-xs">{{ error }}</p>
  </VaultField>
</template>
