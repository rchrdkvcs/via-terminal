<script setup lang="ts">
import type { Id } from '@/ipc/types'

/** One ≈36px row of a vault list. Hover actions go in the `actions` slot. */
defineProps<{ id: Id; selected: boolean; tabbable: boolean }>()
defineEmits<{ select: []; activate: [] }>()
</script>

<template>
  <div
    role="option"
    :data-row-id="id"
    :aria-selected="selected"
    :tabindex="tabbable ? 0 : -1"
    class="group/row relative flex min-h-9 cursor-default items-center gap-3 rounded-md px-2.5 py-1.5 text-[13px] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
    :class="selected ? 'bg-row-selected shadow-row' : 'hover:bg-row-hover'"
    @click="$emit('select')"
    @dblclick="$emit('activate')"
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
