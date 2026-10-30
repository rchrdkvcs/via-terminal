<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :class="
      cn(
        'material-field h-8 w-full min-w-0 rounded-md px-2.5 text-[13px] text-foreground placeholder:text-ink-faint outline-none selection:bg-primary/20 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[13px] file:font-medium disabled:pointer-events-none disabled:opacity-50 aria-invalid:shadow-[inset_0_0_0_1px_var(--state-error)]',
        props.class,
      )
    "
  />
</template>
