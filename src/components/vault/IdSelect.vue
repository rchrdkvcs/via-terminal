<script setup lang="ts">
import { computed } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Id } from '@/ipc/types'
import type { Option } from './useVaultOptions'

const props = defineProps<{ id?: string; options: Option[]; none: string; disabled?: boolean }>()
const model = defineModel<Id | null>({ required: true })
const NONE = '__none__'

const value = computed({
  get: () => model.value ?? NONE,
  set: (next: string) => (model.value = next === NONE ? null : next),
})
const known = computed(
  () => !model.value || props.options.some((option) => option.id === model.value),
)
</script>

<template>
  <Select v-model="value" :disabled="disabled">
    <SelectTrigger :id="id" size="sm" class="w-full text-[13px]">
      <SelectValue :placeholder="none" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem :value="NONE" class="text-muted-foreground text-[13px]">{{ none }}</SelectItem>
      <SelectItem v-if="!known && model" :value="model" disabled class="text-[13px]">
        Élément supprimé
      </SelectItem>
      <SelectItem
        v-for="option in options"
        :key="option.id"
        :value="option.id"
        class="text-[13px]"
        :style="{ paddingInlineStart: `${0.5 + (option.depth ?? 0) * 0.875}rem` }"
      >
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
