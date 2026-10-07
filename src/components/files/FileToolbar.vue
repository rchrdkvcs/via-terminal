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
import { Button } from '@/components/ui/button'
defineProps<{ count: number; enabled: boolean }>()
const emit = defineEmits<{
  create: [directory: boolean]
  upload: [directory: boolean]
  download: []
  rename: []
  chmod: []
  remove: []
}>()
</script>
<template>
  <div
    class="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-hairline px-2 pt-1 pb-2"
    role="group"
    aria-label="Opérations sur les fichiers"
  >
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled"
      aria-label="Nouveau fichier"
      title="Nouveau fichier"
      @click="emit('create', false)"
    >
      <FilePlus :stroke-width="1.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled"
      aria-label="Nouveau dossier"
      title="Nouveau dossier"
      @click="emit('create', true)"
    >
      <FolderPlus :stroke-width="1.5" />
    </Button>
    <span class="mx-1 h-4 w-px bg-hairline" aria-hidden="true" />
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled"
      aria-label="Envoyer des fichiers"
      title="Envoyer des fichiers"
      @click="emit('upload', false)"
    >
      <Upload :stroke-width="1.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled"
      aria-label="Envoyer un dossier"
      title="Envoyer un dossier"
      @click="emit('upload', true)"
    >
      <FolderUp :stroke-width="1.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled || !count"
      aria-label="Télécharger la sélection"
      title="Télécharger la sélection"
      @click="emit('download')"
    >
      <Download :stroke-width="1.5" />
    </Button>
    <span class="mx-1 h-4 w-px bg-hairline" aria-hidden="true" />
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled || count !== 1"
      aria-label="Renommer ou déplacer"
      title="Renommer ou déplacer"
      @click="emit('rename')"
    >
      <Pencil :stroke-width="1.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled || count !== 1"
      aria-label="Modifier les permissions"
      title="Modifier les permissions"
      @click="emit('chmod')"
    >
      <Shield :stroke-width="1.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="!enabled || !count"
      aria-label="Supprimer la sélection"
      title="Supprimer la sélection"
      @click="emit('remove')"
    >
      <Trash2 :stroke-width="1.5" />
    </Button>
  </div>
</template>
