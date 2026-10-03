<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, X } from '@lucide/vue'
import { terminals } from '@/terminal/registry'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'

/** Find in the focused terminal's scrollback. */
const ui = useUi()
const workbench = useWorkbench()
const query = ref('')
const input = ref<HTMLInputElement>()

function find(direction: 1 | -1) {
  const id = workbench.activeTab?.id
  if (id) terminals.search(id, query.value, direction)
}

function close() {
  ui.searching = false
  const id = workbench.activeTab?.id
  if (id) {
    terminals.clearSearch(id)
    terminals.focus(id)
  }
}

watch(
  () => ui.searching,
  async (open) => {
    if (!open) return
    await nextTick()
    input.value?.select()
  },
)
watch(query, () => find(1))

const button =
  'grid size-6 place-items-center rounded-[5px] text-muted-foreground hover:bg-row-hover hover:text-foreground'
</script>

<template>
  <div
    v-if="ui.searching && workbench.activeTab"
    class="absolute end-3 top-3 z-40 flex items-center gap-1 rounded-lg bg-popover p-1 shadow-surface"
    role="search"
  >
    <input
      ref="input"
      v-model="query"
      aria-label="Rechercher dans le terminal"
      placeholder="Rechercher"
      class="h-7 w-52 rounded-md bg-transparent px-2 text-[13px] outline-none"
      @keydown.enter.prevent="find($event.shiftKey ? -1 : 1)"
      @keydown.escape.prevent="close"
    />
    <button type="button" :class="button" aria-label="Résultat précédent" @click="find(-1)">
      <ChevronUp :size="14" :stroke-width="1.5" />
    </button>
    <button type="button" :class="button" aria-label="Résultat suivant" @click="find(1)">
      <ChevronDown :size="14" :stroke-width="1.5" />
    </button>
    <button type="button" :class="button" aria-label="Fermer la recherche" @click="close">
      <X :size="14" :stroke-width="1.5" />
    </button>
  </div>
</template>
