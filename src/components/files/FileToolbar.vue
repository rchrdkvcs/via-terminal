<script setup lang="ts">
import {
  AppWindow,
  Eye,
  EyeOff,
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
/** Selection actions live in the list's context menu; the toolbar keeps creation and view. */
defineProps<{ enabled: boolean; hidden: boolean; docked: boolean }>()
const emit = defineEmits<{
  create: [directory: boolean]
  upload: [directory: boolean]
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
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Afficher les fichiers cachés"
      :title="hidden ? 'Masquer les fichiers cachés' : 'Afficher les fichiers cachés'"
      :aria-pressed="hidden"
      @click="emit('hidden')"
    >
      <component :is="hidden ? Eye : EyeOff" :stroke-width="1.5" />
    </Button>
    <template v-if="docked">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Ouvrir dans un onglet"
        title="Ouvrir dans un onglet"
        @click="emit('detach')"
      >
        <AppWindow :stroke-width="1.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Masquer l’explorateur distant"
        title="Masquer l’explorateur distant"
        @click="emit('hide')"
      >
        <X :stroke-width="1.5" />
      </Button>
    </template>
  </div>
</template>
