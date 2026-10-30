<script setup lang="ts">
import { FolderPlus, Pencil, Plus, Trash2 } from '@lucide/vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import type { Id } from '@/ipc/types'
import { useGroupTree } from './useGroupTree'
import { useVaultState } from './useVaultState'

/** Without a group, the menu of « Tous les hôtes »: only creation applies. */
defineProps<{ groupId: Id | null }>()
const state = useVaultState()
const tree = useGroupTree()

function newHost(groupId: Id | null) {
  tree.choose(groupId)
  state.startCreating()
}
</script>

<template>
  <ContextMenuContent class="min-w-52" @close-auto-focus.prevent>
    <ContextMenuItem @select="newHost(groupId)">
      <Plus :stroke-width="1.5" />
      Nouvel hôte
    </ContextMenuItem>
    <ContextMenuItem @select="tree.add(groupId)">
      <FolderPlus :stroke-width="1.5" />
      {{ groupId ? 'Nouveau sous-groupe' : 'Nouveau groupe' }}
    </ContextMenuItem>
    <template v-if="groupId">
      <ContextMenuSeparator />
      <ContextMenuItem @select="state.renaming.value = groupId">
        <Pencil :stroke-width="1.5" />
        Renommer
        <ContextMenuShortcut>F2</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem variant="destructive" @select="tree.remove(groupId)">
        <Trash2 :stroke-width="1.5" />
        Supprimer
      </ContextMenuItem>
    </template>
  </ContextMenuContent>
</template>
