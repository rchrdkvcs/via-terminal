<script setup lang="ts">
import type { Id } from '@/ipc/types'

defineProps<{ id: Id; selected: boolean; tabbable: boolean }>()
defineEmits<{ select: [] }>()
</script>

<template>
  <div
    role="option"
    :data-row-id="id"
    :aria-selected="selected"
    :tabindex="tabbable ? 0 : -1"
    class="row group/row relative flex min-h-12 cursor-default items-center gap-3 px-2.5 py-1.5 text-[13px] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40"
    @click="$emit('select')"
  >
    <slot />
    <div
      v-if="$slots.actions"
      class="ms-auto flex shrink-0 items-center gap-1"
      :class="
        selected ? '' : 'opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100'
      "
    >
      <slot name="actions" />
    </div>
  </div>
</template>
