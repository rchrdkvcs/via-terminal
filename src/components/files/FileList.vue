<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { File, Folder, Link } from '@lucide/vue'
import type { RemoteEntry } from '@/ipc/files'
import { entrySize } from './fileSize'
import { useFileSelection } from './useFileSelection'
const props = defineProps<{
  entries: RemoteEntry[]
  selected: string[]
  busy: boolean
  hidden: boolean
  connected: boolean
  failed: boolean
}>()
const emit = defineEmits<{
  selectAll: [paths: string[]]
  open: [entry: RemoteEntry]
}>()
const root = ref<HTMLElement>()
const keys = useId()
const visible = computed(() =>
  props.entries.filter((entry) => props.hidden || !entry.name.startsWith('.')),
)
const chosen = computed(
  () => visible.value.filter((entry) => props.selected.includes(entry.path)).length,
)
const columns =
  'grid grid-cols-[minmax(0,1fr)] items-center @[16rem]:grid-cols-[minmax(0,1fr)_5rem] @[20rem]:grid-cols-[minmax(0,1fr)_5rem_3rem]'
const kinds = { directory: 'dossier', link: 'lien symbolique', file: 'fichier', other: 'autre' }
let refocus = false
watch(
  () => props.entries,
  async () => {
    if (!refocus) return
    refocus = false
    await nextTick()
    const target = root.value?.querySelector<HTMLElement>('[role="cell"] button') ?? root.value
    target?.focus()
  },
)
const { select, keydown } = useFileSelection(
  visible,
  () => props.selected,
  (paths) => emit('selectAll', paths),
)
function open(entry: RemoteEntry) {
  refocus = true
  emit('open', entry)
}
</script>
<template>
  <div
    ref="root"
    class="@container min-h-0 flex-1 overflow-auto px-2 pb-2 outline-none"
    tabindex="-1"
    :aria-busy="busy"
    @keydown="keydown"
  >
    <p :id="keys" class="sr-only">
      Double-clic ou Entrée pour ouvrir, Espace pour sélectionner, Cmd ou Ctrl + clic pour ajouter
      ou retirer un élément, Maj + clic ou flèches pour sélectionner une plage, Cmd ou Ctrl + A pour
      tout sélectionner, Échap pour tout désélectionner.
    </p>
    <div role="table" class="text-[12px]" aria-label="Fichiers distants">
      <div role="rowgroup" class="sticky top-0 z-10 bg-rail text-ink-muted">
        <div role="row" :class="[columns, 'h-8']">
          <div role="columnheader" class="truncate px-2 font-medium">
            Nom<span role="status" class="ms-2 font-normal">{{
              chosen ? `${chosen} sélectionné${chosen > 1 ? 's' : ''}` : ''
            }}</span>
          </div>
          <div role="columnheader" class="hidden px-2 text-right font-medium @[16rem]:block">
            Taille
          </div>
          <div role="columnheader" class="hidden pe-2 text-right font-medium @[20rem]:block">
            Droits
          </div>
        </div>
      </div>
      <div role="rowgroup" class="grid gap-px">
        <div
          v-for="entry in visible"
          :key="entry.path"
          role="row"
          :class="[
            columns,
            'row h-8 has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring/40',
          ]"
          :data-selected="selected.includes(entry.path) || undefined"
          @click="select(entry, $event)"
          @dblclick="open(entry)"
        >
          <div role="cell" class="min-w-0">
            <button
              type="button"
              class="flex h-8 w-full items-center gap-2 px-2 text-left outline-none"
              :title="entry.path"
              :aria-describedby="keys"
              :aria-pressed="selected.includes(entry.path)"
              @keydown.space.prevent="select(entry, $event)"
              @keydown.enter.prevent="open(entry)"
            >
              <component
                :is="entry.kind === 'directory' ? Folder : entry.kind === 'link' ? Link : File"
                :size="14"
                :stroke-width="1.5"
                class="shrink-0 text-ink-muted"
                aria-hidden="true"
              /><span class="truncate">{{ entry.name }}</span
              ><span v-if="entry.kind !== 'file'" class="sr-only">, {{ kinds[entry.kind] }}</span>
            </button>
          </div>
          <div
            role="cell"
            class="hidden px-2 text-right whitespace-nowrap text-ink-muted tabular-nums @[16rem]:block"
          >
            {{ entrySize(entry) }}
          </div>
          <div
            role="cell"
            class="hidden pe-2 text-right font-mono text-[11px] text-ink-muted @[20rem]:block"
          >
            {{ entry.permissions === null ? '—' : (entry.permissions & 0o7777).toString(8) }}
          </div>
        </div>
      </div>
    </div>
    <p v-if="busy && !entries.length" class="py-8 text-center text-xs text-ink-muted">
      Chargement…
    </p>
    <p
      v-else-if="connected && !busy && !failed && !visible.length"
      class="py-8 text-center text-xs text-ink-muted"
    >
      {{
        entries.length ? 'Ce dossier ne contient que des fichiers cachés.' : 'Ce dossier est vide.'
      }}
    </p>
  </div>
</template>
