<script setup lang="ts" generic="T extends string">
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** A short exclusive choice, drawn as a macOS segmented control. */
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
    size="sm"
    class="material-sunken gap-0.5 rounded-lg p-0.5"
    :aria-labelledby="labelledby"
    :model-value="value"
    @update:model-value="onUpdate"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="h-6 min-w-0 rounded-[6px] px-3 text-[12.5px] font-normal text-ink-muted transition-[background-color,color,box-shadow] duration-100 hover:bg-transparent hover:text-foreground data-[state=on]:bg-control data-[state=on]:text-foreground data-[state=on]:shadow-[var(--shadow-control)]"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
