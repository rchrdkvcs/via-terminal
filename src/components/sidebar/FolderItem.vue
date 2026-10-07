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
import InlineRename from './InlineRename.vue'
import { LAYOUT_LIMITS } from '@/domain/limits'
import RowArea from './RowArea.vue'

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

const into = computed(
  () => hint.value?.targetId === props.folder.id && hint.value.position === 'into',
)
const toggle = () => spaces.dispatch({ type: 'toggleFolder', id: props.folder.id })
const rename = (name: string) => {
  spaces.dispatch({ type: 'renameFolder', id: props.folder.id, name })
  ui.renaming = null
}
</script>

<template>
  <div>
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div
          ref="element"
          role="button"
          tabindex="0"
          :aria-expanded="folder.open"
          class="row relative flex h-8 items-center gap-2 px-2 text-[13px] text-ink-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          :class="[
            into ? 'bg-row-selected text-foreground shadow-[0_0_0_1.5px_var(--focus)]' : '',
            dragging?.rowId === folder.id ? 'opacity-40' : '',
          ]"
          @click="toggle"
          @keydown.enter.prevent="toggle"
          @keydown.f2.prevent="ui.renaming = folder.id"
          @dblclick.stop="ui.renaming = folder.id"
        >
          <component :is="folder.open ? FolderOpen : Folder" :size="16" :stroke-width="1.5" />
          <InlineRename
            v-if="ui.renaming === folder.id"
            :value="folder.name"
            label="Nom du dossier"
            :maxlength="LAYOUT_LIMITS.nameLength"
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

    <div
      class="grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
      :class="folder.open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
      :inert="!folder.open"
    >
      <div class="min-h-0 overflow-hidden">
        <RowArea
          area="pinned"
          :folder-id="folder.id"
          :entries="folder.rows"
          :label="`Contenu de ${folder.name}`"
          class="ms-[15px] border-s border-hairline ps-1.5 pt-px"
        />
      </div>
    </div>
  </div>
</template>
