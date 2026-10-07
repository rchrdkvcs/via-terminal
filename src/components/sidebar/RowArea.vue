<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Entry, Id } from '@/ipc/types'
import { dragging, useDropZone } from '@/composables/useRowDnd'
import { endTarget, useDropGap } from '@/composables/useDropGap'
import { useSidebarActions } from '@/composables/useSidebarActions'
import DropLine from './DropLine.vue'
import FolderItem from './FolderItem.vue'
import RowItem from './RowItem.vue'

const props = defineProps<{
  area: 'pinned' | 'temporary'
  folderId?: Id | null
  entries: Entry[]
  label: string
}>()
const actions = useSidebarActions()
const gap = useDropGap()
const tail = ref<HTMLElement>()
const folder = computed(() => props.folderId ?? null)

useDropZone(tail, {
  target: () => endTarget(props.area, folder.value),
  canDrop: (source) => !source.isFolder || (props.area === 'pinned' && !folder.value),
  onDrop: (source) => {
    if (folder.value) actions.dropInFolder(source.rowId, folder.value)
    else actions.dropAtEnd(source.rowId, props.area)
  },
})

const emptyPinned = computed(
  () => props.area === 'pinned' && !folder.value && !props.entries.length,
)
</script>

<template>
  <div>
    <ul :aria-label="label" class="flex flex-col gap-px">
      <li v-for="entry in entries" :key="entry.id" class="relative list-none">
        <DropLine v-if="gap.lineBefore(area, folder, entry.id)" at="top" />
        <FolderItem v-if="entry.kind === 'folder'" :folder="entry" />
        <RowItem v-else :row="entry" />
      </li>
    </ul>
    <div
      ref="tail"
      class="relative"
      :class="emptyPinned ? (dragging ? 'py-1' : 'h-0') : folder ? 'h-1.5' : 'h-4'"
    >
      <DropLine v-if="!emptyPinned && gap.lineAtEnd(area, folder)" at="top" />
      <div
        v-if="emptyPinned && dragging"
        class="grid h-10 place-items-center rounded-lg border border-dashed text-xs transition-colors duration-100"
        :class="
          gap.lineAtEnd('pinned')
            ? 'border-foreground/40 bg-row-hover text-foreground'
            : 'border-hairline text-ink-faint'
        "
      >
        Déposer ici pour épingler
      </div>
    </div>
  </div>
</template>
