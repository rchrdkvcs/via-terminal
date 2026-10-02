<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder, FolderOpen, Pencil, Trash2 } from '@lucide/vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Folder as FolderEntry } from '@/ipc/types'
import { dragging, hint, useRowDnd } from '@/composables/useRowDnd'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import DropLine from './DropLine.vue'
import InlineRename from './InlineRename.vue'
import RowItem from './RowItem.vue'

/** A one-level folder; its icon is the only open/closed indicator. */
const props = defineProps<{ folder: FolderEntry }>()
const spaces = useSpaces()
const ui = useUi()
const actions = useSidebarActions()
const element = ref<HTMLElement>()

useRowDnd(element, {
  id: () => props.folder.id,
  isFolder: true,
  acceptsInto: (source) => !source.isFolder,
  onDrop: (source, position) => {
    actions.dropOnRow(source.rowId, props.folder.id, position)
    if (position === 'into')
      spaces.dispatch({ type: 'toggleFolder', id: props.folder.id, open: true })
  },
})

const target = computed(() =>
  hint.value?.targetId === props.folder.id ? hint.value.position : null,
)
const toggle = () => spaces.dispatch({ type: 'toggleFolder', id: props.folder.id })
const rename = (name: string) => {
  spaces.dispatch({ type: 'renameFolder', id: props.folder.id, name })
  ui.renaming = null
}
</script>

<template>
  <li class="list-none">
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div
          ref="element"
          role="button"
          tabindex="0"
          :aria-expanded="folder.open"
          class="relative flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground outline-none transition-colors duration-100 hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          :class="[
            target === 'into' ? 'bg-row-selected text-foreground ring-1 ring-primary/60' : '',
            dragging?.rowId === folder.id ? 'opacity-40' : '',
          ]"
          @click="toggle"
          @keydown.enter.prevent="toggle"
          @keydown.f2.prevent="ui.renaming = folder.id"
          @dblclick.stop="ui.renaming = folder.id"
        >
          <DropLine v-if="target === 'before' || target === 'after'" :position="target" />
          <component :is="folder.open ? FolderOpen : Folder" :size="16" :stroke-width="1.5" />
          <InlineRename
            v-if="ui.renaming === folder.id"
            :value="folder.name"
            label="Nom du dossier"
            @commit="rename"
            @cancel="ui.renaming = null"
          />
          <span v-else class="min-w-0 flex-1 truncate">{{ folder.name }}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-52">
        <ContextMenuItem @select="ui.renaming = folder.id">
          <Pencil :stroke-width="1.5" /> Renommer
        </ContextMenuItem>
        <ContextMenuItem @select="spaces.dispatch({ type: 'deleteFolder', id: folder.id })">
          <Trash2 :stroke-width="1.5" /> Supprimer le dossier
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    <ul
      v-if="folder.open && folder.rows.length"
      class="ms-3 flex flex-col gap-px border-s border-border ps-1.5"
    >
      <RowItem v-for="row in folder.rows" :key="row.id" :row="row" />
    </ul>
  </li>
</template>
