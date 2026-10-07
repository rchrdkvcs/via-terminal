<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowUp, Eye, Maximize2, Minimize2, RefreshCw, X } from '@lucide/vue'
import type { FileState } from '@/stores/files'
const props = defineProps<{ name: string; panel: FileState; connected: boolean; hidden: boolean }>()
const emit = defineEmits<{ navigate: [path: string]; hidden: [] }>()
const path = ref('')
watch(
  () => props.panel.directory,
  (directory) => {
    path.value = directory
  },
  { immediate: true },
)
const navigate = (directory: string) => emit('navigate', directory)
const parent = () => navigate(props.panel.directory.replace(/\/[^/]+\/?$/, '') || '/')
const button =
  'press grid size-7 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40'
</script>
<template>
  <header class="flex h-10 shrink-0 items-center gap-2 border-b border-hairline px-3">
    <div class="min-w-0 flex-1">
      <h2 class="truncate text-xs font-medium">Fichiers · {{ name }}</h2>
    </div>
    <button
      :class="button"
      :aria-label="panel.expanded ? 'Réduire le panneau fichiers' : 'Agrandir le panneau fichiers'"
      :title="panel.expanded ? 'Réduire' : 'Agrandir'"
      @click="panel.expanded = !panel.expanded"
    >
      <Minimize2 v-if="panel.expanded" :size="14" /><Maximize2 v-else :size="14" />
    </button>
    <button
      :class="button"
      aria-label="Masquer l’explorateur distant"
      @click="panel.visible = false"
    >
      <X :size="14" />
    </button>
  </header>
  <form class="flex shrink-0 items-center gap-1 px-2 py-2" @submit.prevent="navigate(path)">
    <button
      type="button"
      :class="button"
      aria-label="Dossier parent"
      :disabled="!connected || panel.directory === '/'"
      @click="parent"
    >
      <ArrowUp :size="14" />
    </button>
    <input
      v-model="path"
      aria-label="Chemin distant"
      spellcheck="false"
      class="material-field h-8 min-w-0 flex-1 rounded-md px-2 font-mono text-xs outline-none"
      :disabled="!connected"
    />
    <button
      type="button"
      :class="button"
      aria-label="Actualiser les fichiers"
      :disabled="!connected || panel.busy"
      @click="navigate(panel.directory)"
    >
      <RefreshCw :size="14" :class="panel.busy ? 'animate-spin motion-reduce:animate-none' : ''" />
    </button>
    <button
      type="button"
      :class="button"
      aria-label="Afficher les fichiers cachés"
      :aria-pressed="hidden"
      @click="emit('hidden')"
    >
      <Eye :size="14" />
    </button>
  </form>
</template>
