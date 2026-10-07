<script setup lang="ts">
import { Input } from '@/components/ui/input'
import VaultField from './VaultField.vue'

withDefaults(defineProps<{ id: string; placeholder: string; label?: string }>(), {
  label: 'Utilisateur',
})
const model = defineModel<string | null>({ required: true })
const emit = defineEmits<{ commit: [] }>()

function update(value: string | number) {
  model.value = String(value).trim() ? String(value) : null
}
</script>

<template>
  <VaultField :label="label" :for="id">
    <Input
      :id="id"
      :model-value="model ?? ''"
      :placeholder="placeholder"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      class="h-8 text-[13px] md:text-[13px]"
      @update:model-value="update"
      @blur="emit('commit')"
    />
  </VaultField>
</template>
