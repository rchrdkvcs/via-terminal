<script setup lang="ts">
defineProps<{ position: 'before' | 'after' }>()
</script>

<template>
  <span
    aria-hidden="true"
    data-drop-row-indicator
    class="pointer-events-none absolute inset-x-0 z-20 flex items-center"
    :class="position === 'before' ? '-top-0.5' : '-bottom-0.5'"
  >
    <span class="size-2 shrink-0 rounded-full border-2 border-sidebar-ring bg-sidebar" />
    <span class="h-0.5 flex-1 bg-sidebar-ring" />
  </span>
</template>
