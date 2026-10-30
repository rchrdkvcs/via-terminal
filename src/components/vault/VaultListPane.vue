<script setup lang="ts">
import { Search } from '@lucide/vue'
import { nextTick, ref, useTemplateRef } from 'vue'
import { Input } from '@/components/ui/input'
import type { Id } from '@/ipc/types'
import { step } from './navigation'

const props = defineProps<{
  title: string
  description: string
  ids: Id[]
  searchLabel?: string
}>()
const emit = defineEmits<{ activate: [id: Id]; remove: [id: Id] }>()
const query = defineModel<string>('query', { default: '' })
const list = useTemplateRef('list')
/** The row keyboard actions apply to. Opening a row is a click, not a selection. */
const cursor = ref<Id | null>(null)

function current(): Id | null {
  return cursor.value && props.ids.includes(cursor.value) ? cursor.value : null
}

function focusRow(id: Id) {
  cursor.value = id
  void nextTick(() =>
    list.value?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus(),
  )
}

function onFocusin(event: FocusEvent) {
  const row = (event.target as Element | null)?.closest<HTMLElement>('[data-row-id]')
  if (row?.dataset.rowId) cursor.value = row.dataset.rowId
}

function onKeydown(event: KeyboardEvent) {
  if ((event.target as Element | null)?.closest('input, textarea')) return
  const next = step(props.ids, current(), event.key)
  if (next) {
    event.preventDefault()
    focusRow(next)
    return
  }
  const id = current()
  if (!id) return
  if (event.key === 'Enter') emit('activate', id)
  else if (event.key === 'Delete') emit('remove', id)
  else return
  event.preventDefault()
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && query.value) {
    event.stopPropagation()
    query.value = ''
  } else if (event.key === 'ArrowDown' && props.ids.length) {
    event.preventDefault()
    focusRow(current() ?? props.ids[0])
  }
}

function tabbable(id: Id): boolean {
  return id === (current() ?? props.ids[0])
}

function isCurrent(id: Id): boolean {
  return id === current()
}
</script>

<template>
  <section class="flex h-full min-w-0 flex-col" :aria-label="title">
    <header class="mx-auto w-full max-w-[880px] shrink-0 px-8 pt-7 pb-4">
      <div class="flex items-start gap-4">
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-[18px] font-semibold tracking-[-0.015em]">{{ title }}</h2>
          <p class="mt-1 max-w-[52ch] text-xs leading-relaxed text-pretty text-ink-muted">
            {{ description }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <slot name="actions" />
        </div>
      </div>
      <div v-if="searchLabel" class="relative mt-4">
        <Search
          class="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
          :stroke-width="1.5"
          aria-hidden="true"
        />
        <Input
          v-model="query"
          type="search"
          :aria-label="searchLabel"
          :placeholder="searchLabel"
          class="ps-8"
          @keydown="onSearchKeydown"
        />
      </div>
    </header>
    <div class="mx-auto w-full max-w-[880px] px-8">
      <slot name="before" />
    </div>
    <div
      v-if="ids.length"
      ref="list"
      role="listbox"
      :aria-label="title"
      class="mx-auto flex min-h-0 w-full max-w-[880px] flex-1 flex-col gap-px overflow-y-auto px-6 pb-6"
      @keydown="onKeydown"
      @focusin="onFocusin"
    >
      <slot :tabbable="tabbable" :current="isCurrent" />
    </div>
    <div v-else class="flex min-h-0 flex-1 items-center justify-center px-8 pb-12">
      <slot name="empty" />
    </div>
  </section>
</template>
