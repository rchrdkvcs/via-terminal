<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Entry, Id, Row } from '@/ipc/types'
import { dragging, useDropZone } from '@/composables/useRowDnd'
import { endTarget, useDropGap } from '@/composables/useDropGap'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useSessions } from '@/stores/sessions'
import { useWorkbench } from '@/stores/workbench'
import DropLine from './DropLine.vue'
import FolderItem from './FolderItem.vue'
import RowItem from './RowItem.vue'

const props = defineProps<{
  area: 'pinned' | 'temporary'
  folderId?: Id | null
  entries: Entry[]
  label: string
  collapsed?: boolean
}>()
const actions = useSidebarActions()
const sessions = useSessions()
const workbench = useWorkbench()
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

// A collapsed folder still shows the rows the user can come back to.
const awake = (row: Row) =>
  (row.kind === 'tab' ? [row] : row.tabs).some(
    (tab) =>
      workbench.activeTab?.id === tab.id ||
      !['asleep', 'exited'].includes(sessions.runtime(tab.id).state),
  )
const shown = (entry: Entry) => !props.collapsed || (entry.kind !== 'folder' && awake(entry))

const emptyPinned = computed(
  () => props.area === 'pinned' && !folder.value && !props.entries.length,
)
</script>

<template>
  <div>
    <ul :aria-label="label" class="flex flex-col">
      <li
        v-for="(entry, index) in entries"
        :key="entry.id"
        class="relative grid list-none transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
        :class="shown(entry) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
        :inert="!shown(entry)"
      >
        <DropLine v-if="gap.lineBefore(area, folder, entry.id)" at="top" />
        <div class="min-h-0" :class="{ 'overflow-hidden': !shown(entry) }">
          <div :class="{ 'pb-px': index < entries.length - 1 }">
            <FolderItem v-if="entry.kind === 'folder'" :folder="entry" />
            <RowItem v-else :row="entry" />
          </div>
        </div>
      </li>
    </ul>
    <div
      ref="tail"
      class="relative"
      :class="
        emptyPinned ? (dragging ? 'py-1' : 'h-0') : collapsed ? 'h-0' : folder ? 'h-1.5' : 'h-4'
      "
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
