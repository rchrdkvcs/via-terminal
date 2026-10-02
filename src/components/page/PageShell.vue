<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'
import { useEventListener } from '@vueuse/core'
import { X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useUi } from '@/stores/ui'

export interface PageSection<T extends string = string> {
  id: T
  label: string
  icon: Component
  count?: number
}

/**
 * The frame shared by full pages (vault, settings): a titled rail of
 * sections on the left, the page on the right, one way out. No borders:
 * the rail is told apart by its half-step tint.
 */
defineProps<{ title: string; closeLabel: string; sections: PageSection<T>[] }>()
const current = defineModel<T>({ required: true })
const ui = useUi()

function close() {
  ui.route = 'workbench'
}

/** Escape leaves the page unless a field, menu or dialog is using it. */
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  const target = event.target instanceof Element ? event.target : null
  const busy =
    '[role="listbox"], [role="menu"], [role="dialog"], [role="alertdialog"], input, textarea, select, [contenteditable]'
  if (target?.closest(busy)) return
  close()
})
</script>

<template>
  <div class="flex h-full min-h-0 text-[13px] text-foreground">
    <nav
      :aria-label="title"
      class="flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto bg-rail px-3 pt-4 pb-3"
    >
      <header class="flex h-7 items-center justify-between ps-2.5">
        <h1 class="text-[15px] font-semibold tracking-[-0.01em]">{{ title }}</h1>
        <Button
          variant="ghost"
          size="icon-xs"
          :aria-label="closeLabel"
          title="Fermer (Échap)"
          @click="close"
        >
          <X :stroke-width="1.5" aria-hidden="true" />
        </Button>
      </header>
      <div class="grid gap-0.5">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :aria-current="current === section.id ? 'page' : undefined"
          class="row flex h-8 items-center gap-2.5 px-2.5 text-start text-ink-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-[current=page]:font-medium"
          @click="current = section.id"
        >
          <component
            :is="section.icon"
            class="size-4 shrink-0"
            :stroke-width="1.5"
            aria-hidden="true"
          />
          <span class="flex-1 truncate">{{ section.label }}</span>
          <span
            v-if="section.count !== undefined"
            class="text-xs font-normal text-ink-faint tabular-nums"
          >
            {{ section.count }}
          </span>
        </button>
      </div>
      <slot name="rail" />
    </nav>
    <div class="relative flex min-w-0 flex-1">
      <slot />
    </div>
  </div>
</template>
