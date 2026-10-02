<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Row } from '@/ipc/types'
import { dragging, useRowDnd } from '@/composables/useRowDnd'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { locate } from '@/domain/space'
import { useSpaces } from '@/stores/spaces'
import TabRow from './TabRow.vue'

/**
 * A draggable row: a tab, or a split view shown as its members side by side
 * (Arc's split row). Dragging a split moves the whole view.
 */
const props = defineProps<{ row: Row }>()
const actions = useSidebarActions()
const spaces = useSpaces()
const element = ref<HTMLElement>()

useRowDnd(element, {
  id: () => props.row.id,
  // A folder may move around a row only at the pinned root.
  canDrop: (source) => {
    const at = locate(spaces.active, props.row.id)
    return !source.isFolder || (at?.area === 'pinned' && at.folderId === null)
  },
  onDrop: (source, position) => actions.dropOnRow(source.rowId, props.row.id, position),
})

const lifted = computed(() => dragging.value?.rowId === props.row.id)
</script>

<template>
  <div
    ref="element"
    class="transition-opacity duration-100"
    :class="lifted ? 'opacity-40' : ''"
    :data-row-id="row.id"
  >
    <TabRow v-if="row.kind === 'tab'" :tab="row" />
    <div
      v-else
      class="flex gap-0.5 rounded-lg bg-row-hover p-0.5"
      role="group"
      :aria-label="`Vue partagée de ${row.tabs.length} onglets`"
    >
      <TabRow v-for="tab in row.tabs" :key="tab.id" :tab="tab" compact />
    </div>
  </div>
</template>
