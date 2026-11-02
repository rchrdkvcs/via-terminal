<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Search, X } from '@lucide/vue'
/** Narrows the listed entries of the current directory by name. */
const props = defineProps<{ open: boolean; count: number; total: number }>()
const query = defineModel<string>({ required: true })
const emit = defineEmits<{ close: [] }>()
const input = ref<HTMLInputElement>()
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    input.value?.focus()
    input.value?.select()
  },
  { immediate: true },
)
function close() {
  query.value = ''
  emit('close')
}
</script>
<template>
  <div
    v-if="open"
    class="flex h-9 shrink-0 items-center gap-2 border-b border-hairline px-3"
    role="search"
  >
    <Search :size="13" :stroke-width="1.5" class="shrink-0 text-ink-faint" aria-hidden="true" />
    <input
      ref="input"
      v-model="query"
      type="search"
      aria-label="Filtrer les fichiers de ce dossier"
      placeholder="Filtrer ce dossier"
      spellcheck="false"
      autocomplete="off"
      class="h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
      @keydown.esc.prevent.stop="close"
    />
    <span v-if="query" class="shrink-0 text-[11px] text-ink-faint tabular-nums" role="status">
      {{ count }} / {{ total }}
    </span>
    <button
      type="button"
      class="grid size-5 shrink-0 place-items-center rounded-[5px] text-ink-muted outline-none hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label="Fermer le filtre"
      @click="close"
    >
      <X :size="13" :stroke-width="1.5" />
    </button>
  </div>
</template>
