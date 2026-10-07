<script setup lang="ts">
import { Ellipsis, FolderPlus, Pencil, Trash2 } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Space } from '@/domain/space'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useSpaceRemoval } from '@/composables/useSpaceRemoval'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { spaceIcon } from './spaceIcons'

defineProps<{ space: Space }>()
const spaces = useSpaces()
const ui = useUi()
const actions = useSidebarActions()
const removal = useSpaceRemoval()

function newFolder() {
  ui.renaming = actions.newFolder()
}
</script>

<template>
  <div class="group/space flex h-8 items-center gap-2 px-2 text-[13px] font-semibold">
    <component :is="spaceIcon(space.icon)" :size="15" :stroke-width="1.5" class="text-ink-muted" />
    <span class="min-w-0 flex-1 truncate" @dblclick="ui.spaceForm = { id: space.id }">
      {{ space.name }}
    </span>
    <DropdownMenu>
      <DropdownMenuTrigger
        class="grid size-6 place-items-center rounded-[5px] text-muted-foreground opacity-0 transition-opacity duration-100 group-hover/space:opacity-100 hover:bg-row-hover hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
        aria-label="Options de l’espace"
      >
        <Ellipsis :size="15" :stroke-width="1.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-52">
        <DropdownMenuItem @select="ui.spaceForm = { id: space.id }">
          <Pencil :stroke-width="1.5" /> Modifier l’espace
        </DropdownMenuItem>
        <DropdownMenuItem @select="newFolder"
          ><FolderPlus :stroke-width="1.5" /> Nouveau dossier</DropdownMenuItem
        >
        <DropdownMenuSeparator />
        <DropdownMenuItem
          :disabled="spaces.spaces.length <= 1"
          class="text-destructive"
          @select="removal.request(space.id)"
        >
          <Trash2 :stroke-width="1.5" /> Supprimer l’espace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
