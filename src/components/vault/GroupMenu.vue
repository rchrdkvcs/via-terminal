<script setup lang="ts">
import { Ellipsis, FolderPlus, Pencil, Trash2 } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Id } from '@/ipc/types'
import { useGroupTree } from './useGroupTree'
import { useVaultState } from './useVaultState'

/** The menu equivalent of the tree's pointer and keyboard shortcuts. */
defineProps<{ groupId: Id; name: string }>()
const state = useVaultState()
const tree = useGroupTree()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring data-[state=open]:opacity-100 grid size-6 shrink-0 place-items-center rounded-[5px] opacity-0 outline-none group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:ring-2"
      :aria-label="`Actions du groupe ${name}`"
    >
      <Ellipsis class="size-3.5" :stroke-width="1.5" />
    </DropdownMenuTrigger>
    <!-- Returning focus to the trigger would blur, and end, an in-place rename. -->
    <DropdownMenuContent align="start" class="min-w-44" @close-auto-focus.prevent>
      <DropdownMenuItem @select="state.renaming.value = groupId">
        <Pencil :stroke-width="1.5" />
        Renommer
      </DropdownMenuItem>
      <DropdownMenuItem @select="tree.add(groupId)">
        <FolderPlus :stroke-width="1.5" />
        Nouveau sous-groupe
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" @select="tree.remove(groupId)">
        <Trash2 :stroke-width="1.5" />
        Supprimer
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
