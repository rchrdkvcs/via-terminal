<script setup lang="ts">
import type { Component } from 'vue'
import { ChevronRight } from '@lucide/vue'

withDefaults(
  defineProps<{ icon: Component; label: string; meta?: string; mono?: boolean; lit?: boolean }>(),
  { meta: undefined, mono: false, lit: false },
)
</script>

<template>
  <button
    type="button"
    class="row group flex h-10 w-full items-center gap-3 px-2.5 text-start text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
  >
    <span
      class="grid size-6 place-items-center rounded-[7px]"
      :class="lit ? 'material-control' : 'text-ink-muted'"
    >
      <component :is="icon" :size="lit ? 13 : 14" :stroke-width="lit ? 1.75 : 1.5" />
    </span>
    <span class="min-w-0 flex-1 truncate">{{ label }}</span>
    <span
      v-if="meta"
      class="max-w-[45%] truncate text-ink-faint"
      :class="mono ? 'font-mono text-[11.5px]' : 'text-xs'"
    >
      {{ meta }}
    </span>
    <ChevronRight :size="14" :stroke-width="1.5" class="chevron shrink-0 text-ink-faint" />
  </button>
</template>

<style scoped>
.chevron {
  opacity: 0;
  translate: -4px 0;
  transition:
    opacity 120ms var(--ease-out),
    translate 160ms var(--ease-out);
}
.group:hover .chevron,
.group:focus-visible .chevron {
  opacity: 1;
  translate: 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}
</style>
