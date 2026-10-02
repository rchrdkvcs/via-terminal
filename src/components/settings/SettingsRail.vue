<script setup lang="ts">
import type { Component } from 'vue'

export interface RailItem {
  id: string
  label: string
  icon: Component
}

defineProps<{ items: RailItem[] }>()
const current = defineModel<string>({ required: true })
</script>

<template>
  <nav aria-label="Sections des réglages" class="flex w-44 shrink-0 flex-col gap-0.5 p-3 pt-12">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :aria-current="current === item.id ? 'page' : undefined"
      class="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-muted-foreground transition-colors duration-150 outline-none hover:bg-row-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none aria-[current=page]:bg-row-selected aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:shadow-row"
      @click="current = item.id"
    >
      <component :is="item.icon" class="size-4 shrink-0" :stroke-width="1.5" aria-hidden="true" />
      {{ item.label }}
    </button>
  </nav>
</template>
