<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  label: string
  active?: boolean
}>()
</script>

<template>
  <div
    class="pointer-events-none flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/70 px-4 text-center text-muted-foreground transition-[background-color,border-color,color] duration-100"
    :class="active ? 'border-ring bg-accent/80 text-foreground' : ''"
  >
    <component :is="icon" :size="20" :stroke-width="1.5" aria-hidden="true" />
    <span class="text-xs">{{ label }}</span>
  </div>
</template>
