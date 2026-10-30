<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'
import { computed } from 'vue'
import { ChevronRight, X } from '@lucide/vue'
import { DialogClose, DialogDescription, DialogTitle } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useUi } from '@/stores/ui'

export interface PageSection<T extends string = string> {
  id: T
  label: string
  icon: Component
  count?: number
}

const props = defineProps<{
  title: string
  closeLabel: string
  sections: PageSection<T>[]
  /** Last breadcrumb, when the page shows one item of the current section. */
  detail?: string | null
}>()
const emit = defineEmits<{ back: [] }>()
const current = defineModel<T>({ required: true })
const ui = useUi()

const section = computed(() => props.sections.find((item) => item.id === current.value))

function close() {
  ui.route = 'workbench'
}

const busy = 'input, textarea, select, [contenteditable]'

function onEscape(event: KeyboardEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (event.defaultPrevented || target?.closest(busy)) {
    event.preventDefault()
    return
  }
  if (props.detail) {
    event.preventDefault()
    emit('back')
  }
}

/** Focuses the page itself, so opening it does not light up the first section. */
function onOpen(event: Event) {
  event.preventDefault()
  ;(event.target as HTMLElement | null)?.focus({ preventScroll: true })
}

function choose(id: T) {
  if (id === current.value && props.detail) emit('back')
  current.value = id
}
</script>

<template>
  <Dialog :open="true" @update:open="(open) => !open && close()">
    <DialogContent
      :show-close-button="false"
      class="flex h-[min(780px,calc(100%-4rem))] w-[min(1120px,calc(100%-4rem))] max-w-none gap-0 overflow-hidden p-0 text-[13px] outline-none text-foreground sm:max-w-none"
      @escape-key-down="onEscape"
      @open-auto-focus="onOpen"
    >
      <nav
        :aria-label="title"
        class="flex w-[240px] shrink-0 flex-col gap-5 overflow-y-auto border-e border-hairline bg-rail px-3 pt-4 pb-3"
      >
        <div class="grid gap-0.5">
          <button
            v-for="item in sections"
            :key="item.id"
            type="button"
            :aria-current="current === item.id ? 'page' : undefined"
            class="row flex h-8 items-center gap-2.5 px-2.5 text-start text-ink-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-[current=page]:font-medium"
            @click="choose(item.id)"
          >
            <component
              :is="item.icon"
              class="size-4 shrink-0"
              :stroke-width="1.5"
              aria-hidden="true"
            />
            <span class="flex-1 truncate">{{ item.label }}</span>
            <span
              v-if="item.count !== undefined"
              class="text-xs font-normal text-ink-faint tabular-nums"
            >
              {{ item.count }}
            </span>
          </button>
        </div>
        <slot name="rail" />
      </nav>
      <div class="flex min-w-0 flex-1 flex-col bg-surface">
        <header class="flex h-13 shrink-0 items-center gap-3 border-b border-hairline ps-6 pe-3">
          <ol
            class="flex min-w-0 flex-1 items-center gap-1.5 text-[14px]"
            aria-label="Fil d’Ariane"
          >
            <li class="shrink-0 text-ink-muted">
              <DialogTitle as="span" class="font-normal">{{ title }}</DialogTitle>
            </li>
            <li class="flex min-w-0 items-center gap-1.5" :class="detail ? 'shrink-0' : ''">
              <ChevronRight class="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
              <button
                v-if="detail"
                type="button"
                class="rounded-md text-ink-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                @click="emit('back')"
              >
                {{ section?.label }}
              </button>
              <span v-else class="truncate font-medium" aria-current="page">{{
                section?.label
              }}</span>
            </li>
            <li v-if="detail" class="flex min-w-0 items-center gap-1.5">
              <ChevronRight class="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
              <span class="truncate font-medium" aria-current="page">{{ detail }}</span>
            </li>
          </ol>
          <DialogDescription class="sr-only">Appuyez sur Échap pour fermer.</DialogDescription>
          <div class="flex shrink-0 items-center gap-1">
            <slot name="actions" />
            <DialogClose as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="closeLabel"
                title="Fermer (Échap)"
              >
                <X :stroke-width="1.5" aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        </header>
        <div class="relative flex min-h-0 flex-1">
          <slot />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
