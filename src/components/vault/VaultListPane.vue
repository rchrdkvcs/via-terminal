<script setup lang="ts">
import { Search } from '@lucide/vue'
import { nextTick, useTemplateRef } from 'vue'
import { Input } from '@/components/ui/input'
import type { Id } from '@/ipc/types'
import { step } from './navigation'

const props = defineProps<{
  title: string
  ids: Id[]
  selected: Id | null
  searchLabel?: string
}>()
const emit = defineEmits<{ select: [id: Id]; activate: [id: Id]; remove: [id: Id] }>()
const query = defineModel<string>('query', { default: '' })
const list = useTemplateRef('list')

function focusRow(id: Id) {
  void nextTick(() =>
    list.value?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus(),
  )
}

function onKeydown(event: KeyboardEvent) {
  const next = step(props.ids, props.selected, event.key)
  if (next) {
    event.preventDefault()
    emit('select', next)
    focusRow(next)
    return
  }
  if (!props.selected) return
  if (event.key === 'Enter') emit('activate', props.selected)
  else if (event.key === 'Delete') emit('remove', props.selected)
  else return
  event.preventDefault()
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && query.value) {
    event.stopPropagation()
    query.value = ''
  } else if (event.key === 'ArrowDown' && props.ids.length) {
    event.preventDefault()
    const first =
      props.selected && props.ids.includes(props.selected) ? props.selected : props.ids[0]
    emit('select', first)
    focusRow(first)
  }
}

function tabbable(id: Id): boolean {
  const current =
    props.selected && props.ids.includes(props.selected) ? props.selected : props.ids[0]
  return id === current
}
</script>

<template>
  <section class="flex h-full min-w-0 flex-col" :aria-label="title">
    <header class="shrink-0 px-5 pt-3.5 pb-3">
      <div class="flex h-8 items-center gap-3">
        <h2 class="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
          {{ title }}
        </h2>
        <div class="flex shrink-0 items-center gap-1.5">
          <slot name="actions" />
        </div>
      </div>
      <div v-if="searchLabel" class="relative mt-2.5">
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
    <slot name="before" />
    <div
      v-if="ids.length"
      ref="list"
      role="listbox"
      :aria-label="title"
      class="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-3 pb-3"
      @keydown="onKeydown"
    >
      <slot :tabbable="tabbable" />
    </div>
    <div v-else class="flex min-h-0 flex-1 items-center justify-center px-8 pb-12">
      <slot name="empty" />
    </div>
  </section>
</template>
