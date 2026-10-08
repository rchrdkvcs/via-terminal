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
import { Search } from '@lucide/vue'
import { Kbd } from '@/components/ui/kbd'
import { useUi } from '@/stores/ui'
import CommandRow from './CommandRow.vue'
import { useCommandResults } from './useCommandResults'

const ui = useUi()
const query = ref('')
const active = ref(0)
const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()
const { placeholder, items, choose, initialQuery } = useCommandResults(query)

const open = computed({
  get: () => ui.command !== null,
  set: (value) => !value && ui.closeCommand(),
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = initialQuery()
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
      <DialogOverlay class="fixed inset-0 z-50 bg-black/15 dark:bg-black/35" />
      <DialogContent
        class="material-raised fixed start-1/2 top-[13vh] z-50 flex max-h-[min(580px,72vh)] w-[min(660px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl text-popover-foreground outline-none"
        @open-auto-focus.prevent
        @close-auto-focus="ui.renaming !== null && $event.preventDefault()"
      >
        <DialogTitle class="sr-only">Barre de commande</DialogTitle>
        <DialogDescription class="sr-only"
          >Rechercher un hôte, un terminal ou une action.</DialogDescription
        >
        <div class="flex h-[52px] shrink-0 items-center gap-3 border-b border-hairline px-4">
          <Search
            :size="17"
            :stroke-width="1.5"
            class="shrink-0 text-ink-faint"
            aria-hidden="true"
          />
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
            class="h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-[-0.01em] outline-none placeholder:text-ink-faint"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.tab.prevent="move($event.shiftKey ? -1 : 1)"
            @keydown.enter.prevent="submit"
          />
        </div>
        <div id="command-results" ref="list" role="listbox" class="min-h-0 overflow-y-auto p-1.5">
          <template v-for="(item, index) in items" :key="item.id">
            <div
              v-if="showSection(index)"
              class="px-2.5 pt-2.5 pb-1 text-xs font-medium text-ink-faint"
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
          <p v-if="!items.length" class="px-3 py-8 text-center text-[13px] text-ink-muted">
            Aucun résultat. Tapez une adresse comme admin@10.0.0.5 pour vous y connecter.
          </p>
        </div>
        <footer
          class="flex h-9 shrink-0 items-center gap-4 border-t border-hairline px-3.5 text-[11.5px] text-ink-faint"
        >
          <span class="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
          <span class="flex items-center gap-1.5"><Kbd>Entrée</Kbd> ouvrir</span>
          <span class="ms-auto flex items-center gap-1.5"><Kbd>Échap</Kbd> fermer</span>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
