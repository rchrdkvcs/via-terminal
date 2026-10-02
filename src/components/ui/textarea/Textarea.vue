<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  defaultValue?: string | number
  modelValue?: string | number
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
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :class="
      cn(
        'material-sunken flex field-sizing-content min-h-16 w-full rounded-md px-2.5 py-2 text-[13px] placeholder:text-ink-faint outline-none disabled:opacity-50 aria-invalid:shadow-[inset_0_0_0_1px_var(--state-error)]',
        props.class,
      )
    "
  />
</template>
