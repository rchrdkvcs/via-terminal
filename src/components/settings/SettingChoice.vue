<script setup lang="ts" generic="T extends string">
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** A short exclusive choice, drawn as a segmented toggle group. */
const props = defineProps<{
  options: { value: T; label: string }[]
  labelledby?: string
}>()

const value = defineModel<T>({ required: true })

/** Pressing the active item again emits an empty value; keep the choice instead. */
function onUpdate(next: unknown) {
  const option = props.options.find((candidate) => candidate.value === next)
  if (option) value.value = option.value
}
</script>

<template>
  <ToggleGroup
    type="single"
    variant="outline"
    size="sm"
    :aria-labelledby="labelledby"
    :model-value="value"
    @update:model-value="onUpdate"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="h-7 px-3 text-[13px] font-normal"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
