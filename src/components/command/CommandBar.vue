<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { useUi } from '@/stores/ui'
import CommandRow from './CommandRow.vue'
import { useCommandResults } from './useCommandResults'

/**
 * Arc's command bar: one field for every way to open something. Arrow keys
 * move, Enter opens, Escape closes; the first line is always selected.
 */
const ui = useUi()
const query = ref('')
const active = ref(0)
const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()
const { placeholder, items, choose } = useCommandResults(query)

const open = computed({
  get: () => ui.command !== null,
  set: (value) => !value && ui.closeCommand(),
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  active.value = 0
  await nextTick()
  input.value?.focus()
})
watch(query, () => (active.value = 0))

function move(step: number) {
  if (!items.value.length) return
  active.value = (active.value + step + items.value.length) % items.value.length
  void nextTick(() =>
    list.value?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' }),
  )
}

function submit() {
  const item = items.value[active.value]
  if (item) choose(item)
}

const showSection = (index: number) =>
  index === 0 || items.value[index - 1].section !== items.value[index].section
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-black/25 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
      />
      <DialogContent
        class="fixed start-1/2 top-[14vh] z-50 flex max-h-[min(560px,72vh)] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] motion-reduce:animate-none"
        @open-auto-focus.prevent
      >
        <DialogTitle class="sr-only">Barre de commande</DialogTitle>
        <DialogDescription class="sr-only"
          >Rechercher un hôte, un terminal ou une action.</DialogDescription
        >
        <input
          ref="input"
          v-model="query"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          :aria-activedescendant="items[active] ? `command-${items[active].id}` : undefined"
          :placeholder="placeholder"
          spellcheck="false"
          autocomplete="off"
          class="h-12 w-full shrink-0 border-b border-border bg-transparent px-4 text-[15px] outline-none placeholder:text-muted-foreground"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.tab.prevent="move($event.shiftKey ? -1 : 1)"
          @keydown.enter.prevent="submit"
        />
        <div
          id="command-results"
          ref="list"
          role="listbox"
          class="scrollbar-thin min-h-0 overflow-y-auto p-1.5"
        >
          <template v-for="(item, index) in items" :key="item.id">
            <div
              v-if="showSection(index)"
              class="px-2.5 pt-2.5 pb-1 text-xs text-muted-foreground"
              role="presentation"
            >
              {{ item.section }}
            </div>
            <CommandRow
              :item="item"
              :active="index === active"
              @pointermove="active = index"
              @click="choose(item)"
            />
          </template>
          <p v-if="!items.length" class="px-3 py-6 text-center text-[13px] text-muted-foreground">
            Aucun résultat. Tapez une adresse comme admin@10.0.0.5 pour vous y connecter.
          </p>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
