<script setup lang="ts">
import {
  AppWindow,
  Check,
  Ellipsis,
  Eye,
  FilePlus,
  FolderPlus,
  FolderUp,
  Plus,
  Upload,
  X,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import FileSelectionActions from './FileSelectionActions.vue'
defineProps<{ count: number; enabled: boolean; hidden: boolean; docked: boolean }>()
const emit = defineEmits<{
  create: [directory: boolean]
  upload: [directory: boolean]
  download: []
  rename: []
  chmod: []
  remove: []
  hidden: []
  detach: []
  hide: []
}>()
</script>
<template>
  <div
    class="ms-auto flex shrink-0 items-center gap-1"
    role="group"
    aria-label="Opérations sur les fichiers"
  >
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Créer ou envoyer"
          title="Créer ou envoyer"
          :disabled="!enabled"
        >
          <Plus :stroke-width="1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem :disabled="!enabled" @select="emit('create', false)">
          <FilePlus :stroke-width="1.5" />Nouveau fichier
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="!enabled" @select="emit('create', true)">
          <FolderPlus :stroke-width="1.5" />Nouveau dossier
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="!enabled" @select="emit('upload', false)">
          <Upload :stroke-width="1.5" />Envoyer des fichiers
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="!enabled" @select="emit('upload', true)">
          <FolderUp :stroke-width="1.5" />Envoyer un dossier
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Autres actions"
          title="Autres actions"
        >
          <Ellipsis :stroke-width="1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem role="menuitemcheckbox" :aria-checked="hidden" @select="emit('hidden')">
          <Eye :stroke-width="1.5" />Afficher les fichiers cachés
          <Check v-if="hidden" class="ms-auto" :stroke-width="1.5" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <FileSelectionActions
          :count="count"
          :enabled="enabled"
          @download="emit('download')"
          @rename="emit('rename')"
          @chmod="emit('chmod')"
          @remove="emit('remove')"
        />
        <template v-if="docked">
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="emit('detach')">
            <AppWindow :stroke-width="1.5" />Ouvrir dans un onglet
          </DropdownMenuItem>
          <DropdownMenuItem @select="emit('hide')">
            <X :stroke-width="1.5" />Masquer l’explorateur distant
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
