<script setup lang="ts">
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'

defineProps<{ label: string; description?: string; forId?: string; stacked?: boolean }>()
</script>

<template>
  <!--
    One row per setting: name and explanation on the leading edge, control on
    the trailing edge. No divider — space alone carries the grouping.
  -->
  <Field :orientation="stacked ? 'vertical' : 'responsive'" class="py-4 sm:gap-6">
    <FieldContent>
      <FieldLabel :for="forId">{{ label }}</FieldLabel>
      <FieldDescription v-if="description">{{ description }}</FieldDescription>
    </FieldContent>
    <div class="shrink-0" :class="stacked ? 'w-full' : 'w-full sm:w-auto'">
      <slot />
    </div>
  </Field>
</template>
