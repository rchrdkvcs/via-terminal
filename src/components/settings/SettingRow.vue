<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  label: string
  description?: string
}>()

/** Ids handed to the control so its label and description are announced. */
const id = useId()
const labelId = `${id}-label`
const descriptionId = `${id}-description`
</script>

<template>
  <div class="flex items-center justify-between gap-6 py-3">
    <div class="min-w-0 flex-1">
      <label
        :id="labelId"
        :for="id"
        class="block text-[13px] leading-5 font-medium text-foreground"
      >
        {{ label }}
      </label>
      <p
        v-if="description"
        :id="descriptionId"
        class="mt-0.5 text-xs leading-4 text-pretty text-muted-foreground"
      >
        {{ description }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot
        :id="id"
        :label-id="labelId"
        :description-id="description ? descriptionId : undefined"
      />
    </div>
  </div>
</template>
