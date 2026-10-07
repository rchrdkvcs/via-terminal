<script setup lang="ts">
import { File, Folder, Link } from '@lucide/vue'
import type { RemoteEntry } from '@/ipc/files'
defineProps<{ entries: RemoteEntry[]; selected: string[]; busy: boolean; hidden: boolean }>()
const emit = defineEmits<{
  select: [path: string, selected: boolean]
  open: [entry: RemoteEntry]
}>()
const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} o`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} Ko`
      : `${(bytes / 1024 / 1024).toFixed(1)} Mo`
</script>
<template>
  <div class="min-h-0 flex-1 overflow-auto px-2 pb-2" :aria-busy="busy">
    <table class="w-full table-fixed text-left text-[12px]" aria-label="Fichiers distants">
      <thead class="sticky top-0 bg-surface text-ink-faint">
        <tr>
          <th class="w-8 p-2"><span class="sr-only">Sélection</span></th>
          <th class="py-2 font-medium">Nom</th>
          <th class="w-20 px-2 py-2 text-right font-medium">Taille</th>
          <th class="w-12 py-2 text-right font-medium">Droits</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entry in entries.filter((entry) => hidden || !entry.name.startsWith('.'))"
          :key="entry.path"
          class="group hover:bg-row-hover"
          :class="selected.includes(entry.path) ? 'bg-row-selected' : ''"
          @dblclick="emit('open', entry)"
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
              @click="emit('select', entry.path, !selected.includes(entry.path))"
              @keydown.enter.prevent="emit('open', entry)"
            >
              <component
                :is="entry.kind === 'directory' ? Folder : entry.kind === 'link' ? Link : File"
                :size="14"
                class="shrink-0 text-ink-muted"
              /><span class="truncate" :title="entry.name">{{ entry.name }}</span>
            </button>
          </td>
          <td class="whitespace-nowrap px-2 text-right tabular-nums text-ink-faint">
            {{ entry.kind === 'directory' ? '—' : size(entry.size) }}
          </td>
          <td class="text-right font-mono text-[11px] text-ink-faint">
            {{ entry.permissions === null ? '—' : (entry.permissions & 0o7777).toString(8) }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!entries.length && !busy" class="py-8 text-center text-xs text-ink-muted">
      Ce dossier est vide.
    </p>
  </div>
</template>
