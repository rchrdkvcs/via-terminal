<script setup lang="ts">
import {
  AppWindow,
  Check,
  Copy,
  Download,
  Eye,
  FilePlus,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
/** With a selection, acts on it; on the empty list, acts on the current directory. */
defineProps<{ count: number; enabled: boolean; hidden: boolean; docked: boolean }>()
const emit = defineEmits<{
  open: []
  copy: []
  download: []
  rename: []
  chmod: []
  remove: []
  create: [directory: boolean]
  upload: [directory: boolean]
  refresh: []
  hidden: []
  detach: []
  hide: []
}>()
</script>
<template>
  <ContextMenuContent class="w-60">
    <template v-if="count">
      <ContextMenuItem :disabled="!enabled || count !== 1" @select="emit('open')">
        <FolderOpen :stroke-width="1.5" />Ouvrir
        <ContextMenuShortcut>Entrée</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem :disabled="!enabled" @select="emit('download')">
        <Download :stroke-width="1.5" />{{
          count > 1 ? `Télécharger ${count} éléments` : 'Télécharger'
        }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem :disabled="!enabled || count !== 1" @select="emit('rename')">
        <Pencil :stroke-width="1.5" />Renommer ou déplacer…
        <ContextMenuShortcut>F2</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem :disabled="!enabled || count !== 1" @select="emit('chmod')">
        <Shield :stroke-width="1.5" />Modifier les permissions…
      </ContextMenuItem>
      <ContextMenuItem @select="emit('copy')">
        <Copy :stroke-width="1.5" />{{ count > 1 ? 'Copier les chemins' : 'Copier le chemin' }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" :disabled="!enabled" @select="emit('remove')">
        <Trash2 :stroke-width="1.5" />{{ count > 1 ? `Supprimer ${count} éléments` : 'Supprimer' }}
        <ContextMenuShortcut>Suppr</ContextMenuShortcut>
      </ContextMenuItem>
    </template>
    <template v-else>
      <ContextMenuItem :disabled="!enabled" @select="emit('create', false)">
        <FilePlus :stroke-width="1.5" />Nouveau fichier
      </ContextMenuItem>
      <ContextMenuItem :disabled="!enabled" @select="emit('create', true)">
        <FolderPlus :stroke-width="1.5" />Nouveau dossier
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem :disabled="!enabled" @select="emit('upload', false)">
        <Upload :stroke-width="1.5" />Envoyer des fichiers
      </ContextMenuItem>
      <ContextMenuItem :disabled="!enabled" @select="emit('upload', true)">
        <FolderUp :stroke-width="1.5" />Envoyer un dossier
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem role="menuitemcheckbox" :aria-checked="hidden" @select="emit('hidden')">
        <Eye :stroke-width="1.5" />Afficher les fichiers cachés
        <Check v-if="hidden" class="ms-auto" :stroke-width="1.5" />
      </ContextMenuItem>
      <ContextMenuItem :disabled="!enabled" @select="emit('refresh')">
        <RefreshCw :stroke-width="1.5" />Actualiser
      </ContextMenuItem>
      <template v-if="docked">
        <ContextMenuSeparator />
        <ContextMenuItem @select="emit('detach')">
          <AppWindow :stroke-width="1.5" />Ouvrir dans un onglet
        </ContextMenuItem>
        <ContextMenuItem @select="emit('hide')">
          <X :stroke-width="1.5" />Masquer l’explorateur distant
        </ContextMenuItem>
      </template>
    </template>
  </ContextMenuContent>
</template>
