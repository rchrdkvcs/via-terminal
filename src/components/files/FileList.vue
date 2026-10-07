<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { File, Folder, Link } from '@lucide/vue'
import type { RemoteEntry } from '@/ipc/files'
const props = defineProps<{
  entries: RemoteEntry[]
  selected: string[]
  busy: boolean
  hidden: boolean
  connected: boolean
  failed: boolean
}>()
const emit = defineEmits<{
  select: [path: string, selected: boolean]
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
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const size = (entry: RemoteEntry) =>
  entry.kind !== 'file'
    ? '—'
    : entry.size < 1024
      ? `${entry.size} o`
      : entry.size < 1024 * 1024
        ? `${number.format(entry.size / 1024)} Ko`
        : `${number.format(entry.size / 1024 / 1024)} Mo`
const kinds = { directory: 'dossier', link: 'lien symbolique', file: 'fichier', other: 'autre' }
let refocus = false
watch(
  () => props.entries,
  async () => {
    if (!refocus) return
    refocus = false
    await nextTick()
    const target = root.value?.querySelector<HTMLElement>('tbody button') ?? root.value
    target?.focus()
  },
)
function deselect(event: KeyboardEvent) {
  if (!chosen.value) return
  event.stopPropagation()
  emit('selectAll', [])
}
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
    @keydown.esc="deselect"
  >
    <p :id="keys" class="sr-only">
      Entrée pour ouvrir, Espace pour sélectionner, Échap pour tout désélectionner.
    </p>
    <table class="w-full table-fixed text-left text-[12px]" aria-label="Fichiers distants">
      <thead class="sticky top-0 z-10 bg-surface text-ink-muted">
        <tr>
          <th class="w-8 p-2">
            <input
              type="checkbox"
              aria-label="Tout sélectionner"
              :checked="!!visible.length && chosen === visible.length"
              :indeterminate="!!chosen && chosen < visible.length"
              :disabled="!visible.length"
              @change="
                emit(
                  'selectAll',
                  ($event.target as HTMLInputElement).checked
                    ? visible.map((entry) => entry.path)
                    : [],
                )
              "
            />
          </th>
          <th class="py-2 font-medium">
            Nom<span role="status" class="ms-2 font-normal">{{
              chosen ? `${chosen} sélectionné${chosen > 1 ? 's' : ''}` : ''
            }}</span>
          </th>
          <th class="hidden w-20 px-2 py-2 text-right font-medium @[16rem]:table-cell">Taille</th>
          <th class="hidden w-12 py-2 text-right font-medium @[20rem]:table-cell">Droits</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entry in visible"
          :key="entry.path"
          class="row"
          :data-selected="selected.includes(entry.path) || undefined"
          @dblclick="open(entry)"
        >
          <td class="p-2">
            <input
              type="checkbox"
              :aria-label="`Sélectionner ${entry.name}`"
              :checked="selected.includes(entry.path)"
              @change="emit('select', entry.path, ($event.target as HTMLInputElement).checked)"
            />
          </td>
          <td class="max-w-0">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :title="entry.path"
              :aria-describedby="keys"
              @click="emit('select', entry.path, !selected.includes(entry.path))"
              @keydown.enter.prevent="open(entry)"
            >
              <component
                :is="entry.kind === 'directory' ? Folder : entry.kind === 'link' ? Link : File"
                :size="14"
                class="shrink-0 text-ink-muted"
                aria-hidden="true"
              /><span class="truncate">{{ entry.name }}</span
              ><span v-if="entry.kind !== 'file'" class="sr-only">, {{ kinds[entry.kind] }}</span>
            </button>
          </td>
          <td
            class="hidden whitespace-nowrap px-2 text-right tabular-nums text-ink-muted @[16rem]:table-cell"
          >
            {{ size(entry) }}
          </td>
          <td class="hidden text-right font-mono text-[11px] text-ink-muted @[20rem]:table-cell">
            {{ entry.permissions === null ? '—' : (entry.permissions & 0o7777).toString(8) }}
          </td>
        </tr>
      </tbody>
    </table>
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
