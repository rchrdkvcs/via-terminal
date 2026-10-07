<script setup lang="ts">
defineProps<{ at: 'top' | 'bottom' }>()
</script>

<template>
  <span
    class="pointer-events-none absolute inset-x-1.5 z-10 flex h-[2px] items-center"
    :class="at === 'top' ? '-top-[1.5px]' : '-bottom-[1.5px]'"
    aria-hidden="true"
  >
    <span class="size-[6px] shrink-0 rounded-full border-[1.5px] border-foreground/80 bg-chrome" />
    <span class="h-[2px] flex-1 rounded-full bg-foreground/80" />
  </span>
</template>
