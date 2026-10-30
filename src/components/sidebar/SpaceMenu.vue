<script setup lang="ts">
import { FolderPlus, Pencil, Plus, Trash2 } from '@lucide/vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import type { Space } from '@/domain/space'
import { useClosing } from '@/composables/useClosing'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'

const props = defineProps<{ space: Space }>()
const spaces = useSpaces()
const ui = useUi()
const actions = useSidebarActions()
const closing = useClosing()
const kbd = useShortcutLabel()

/** Tabs and folders are created in the active space, so the menu's space comes first. */
function inSpace(run: () => void) {
  if (spaces.active.id !== props.space.id) spaces.activate(props.space.id)
  run()
}
</script>

<template>
  <ContextMenuContent class="w-56" @close-auto-focus="ui.renaming && $event.preventDefault()">
    <ContextMenuItem @select="inSpace(() => ui.openCommand({ kind: 'new' }))">
      <Plus :stroke-width="1.5" /> Nouvel onglet
      <ContextMenuShortcut>{{ kbd('newTab') }}</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem @select="inSpace(() => (ui.renaming = actions.newFolder()))">
      <FolderPlus :stroke-width="1.5" /> Nouveau dossier
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem @select="ui.spaceForm = { id: space.id }">
      <Pencil :stroke-width="1.5" /> Modifier l’espace…
    </ContextMenuItem>
    <ContextMenuItem
      variant="destructive"
      :disabled="spaces.spaces.length <= 1"
      @select="closing.removeSpace(space.id)"
    >
      <Trash2 :stroke-width="1.5" /> Supprimer l’espace
    </ContextMenuItem>
  </ContextMenuContent>
</template>
