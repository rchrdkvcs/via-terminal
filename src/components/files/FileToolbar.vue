<script setup lang="ts">
import {
  Download,
  FilePlus,
  FolderPlus,
  FolderUp,
  Pencil,
  Shield,
  Trash2,
  Upload,
} from '@lucide/vue'
defineProps<{ count: number; enabled: boolean }>()
const emit = defineEmits<{
  create: [directory: boolean]
  upload: [directory: boolean]
  download: []
  rename: []
  chmod: []
  remove: []
}>()
const button =
  'press grid size-8 place-items-center rounded-md text-ink-muted hover:bg-row-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30'
</script>
<template>
  <div
    class="flex shrink-0 items-center gap-0.5 border-b border-hairline px-2 py-1.5"
    role="toolbar"
    aria-label="Opérations sur les fichiers"
  >
    <button
      :class="button"
      :disabled="!enabled"
      aria-label="Nouveau fichier"
      title="Nouveau fichier"
      @click="emit('create', false)"
    >
      <FilePlus :size="15" />
    </button>
    <button
      :class="button"
      :disabled="!enabled"
      aria-label="Nouveau dossier"
      title="Nouveau dossier"
      @click="emit('create', true)"
    >
      <FolderPlus :size="15" />
    </button>
    <span class="mx-1 h-4 w-px bg-hairline" />
    <button
      :class="button"
      :disabled="!enabled"
      aria-label="Envoyer des fichiers"
      title="Envoyer des fichiers"
      @click="emit('upload', false)"
    >
      <Upload :size="15" />
    </button>
    <button
      :class="button"
      :disabled="!enabled"
      aria-label="Envoyer un dossier"
      title="Envoyer un dossier"
      @click="emit('upload', true)"
    >
      <FolderUp :size="15" />
    </button>
    <button
      :class="button"
      :disabled="!enabled || !count"
      aria-label="Télécharger la sélection"
      title="Télécharger la sélection"
      @click="emit('download')"
    >
      <Download :size="15" />
    </button>
    <span class="mx-1 h-4 w-px bg-hairline" />
    <button
      :class="button"
      :disabled="!enabled || count !== 1"
      aria-label="Renommer ou déplacer"
      title="Renommer ou déplacer"
      @click="emit('rename')"
    >
      <Pencil :size="15" />
    </button>
    <button
      :class="button"
      :disabled="!enabled || count !== 1"
      aria-label="Modifier les permissions"
      title="Modifier les permissions"
      @click="emit('chmod')"
    >
      <Shield :size="15" />
    </button>
    <button
      :class="button"
      :disabled="!enabled || !count"
      aria-label="Supprimer la sélection"
      title="Supprimer la sélection"
      @click="emit('remove')"
    >
      <Trash2 :size="15" />
    </button>
  </div>
</template>
