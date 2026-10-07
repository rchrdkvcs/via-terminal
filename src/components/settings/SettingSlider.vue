<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

const props = defineProps<{
  min: number
  max: number
  step: number
  label: string

  format: (value: number) => string
}>()

const value = defineModel<number>({ required: true })

function onUpdate(values: number[] | undefined) {
  const next = values?.[0]
  if (next === undefined) return
  const decimals = String(props.step).split('.')[1]?.length ?? 0
  value.value = Number(next.toFixed(decimals))
}
</script>

<template>
  <SliderRoot
    class="relative flex w-36 touch-none items-center select-none"
    :min="min"
    :max="max"
    :step="step"
    :model-value="[value]"
    @update:model-value="onUpdate"
  >
    <SliderTrack
      class="relative h-1 grow overflow-hidden rounded-full bg-sunken shadow-[var(--shadow-sunken)]"
    >
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      :aria-label="label"
      :aria-valuetext="format(value)"
      class="block size-4 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-shadow outline-none hover:ring-4 focus-visible:ring-4 motion-reduce:transition-none"
    />
  </SliderRoot>
  <output class="w-10 text-right text-[13px] text-muted-foreground tabular-nums">
    {{ format(value) }}
  </output>
</template>
