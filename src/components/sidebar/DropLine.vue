<script setup lang="ts">
/** Where a dragged row will land: a line on the edge it will take. */
defineProps<{ position: 'before' | 'after' }>()
</script>

<template>
  <span
    class="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-primary"
    :class="position === 'before' ? '-top-px' : '-bottom-px'"
    aria-hidden="true"
  />
</template>
