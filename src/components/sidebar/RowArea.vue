<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Entry } from '@/ipc/types'
import { dragging, useDropZone } from '@/composables/useRowDnd'
import { useSidebarActions } from '@/composables/useSidebarActions'
import FolderItem from './FolderItem.vue'
import RowItem from './RowItem.vue'

/**
 * The pinned or temporary list. Its trailing space is a drop zone, so a row
 * can be dropped at the end, or into an empty pinned area.
 */
const props = defineProps<{ area: 'pinned' | 'temporary'; entries: Entry[]; label: string }>()
const actions = useSidebarActions()
const tail = ref<HTMLElement>()
const over = ref(false)

useDropZone(tail, {
  canDrop: (source) => props.area === 'pinned' || !source.isFolder,
  onOver: () => (over.value = true),
  onLeave: () => (over.value = false),
  onDrop: (source) => actions.dropAtEnd(source.rowId, props.area),
})

const empty = computed(() => props.entries.length === 0)
</script>

<template>
  <div>
    <ul :aria-label="label" class="flex flex-col gap-px">
      <template v-for="entry in entries" :key="entry.id">
        <FolderItem v-if="entry.kind === 'folder'" :folder="entry" />
        <RowItem v-else :row="entry" />
      </template>
    </ul>
    <div
      ref="tail"
      class="rounded-md transition-[height,background-color] duration-150"
      :class="[
        empty && area === 'pinned' ? (dragging ? 'h-10' : 'h-0') : 'h-3',
        over ? 'bg-row-hover' : '',
        empty && area === 'pinned' && dragging
          ? 'mt-1 grid place-items-center border border-dashed border-border text-xs text-muted-foreground'
          : '',
      ]"
    >
      <span v-if="empty && area === 'pinned' && dragging">Déposer ici pour épingler</span>
    </div>
  </div>
</template>
