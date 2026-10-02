<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Edge } from '@/domain/split'
import { canSplit } from '@/domain/split'
import { dragging, useDropZone } from '@/composables/useRowDnd'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useSpaces } from '@/stores/spaces'
import { useWorkbench } from '@/stores/workbench'

/**
 * While a row is dragged, the content edges become split targets.
 * The preview shows the half the dropped tab will take.
 */
const spaces = useSpaces()
const workbench = useWorkbench()
const actions = useSidebarActions()
const zone = ref<HTMLElement>()
const edge = ref<Edge | null>(null)

function edgeAt(input: { clientX: number; clientY: number }): Edge {
  const rect = zone.value!.getBoundingClientRect()
  const x = (input.clientX - rect.left) / rect.width
  const y = (input.clientY - rect.top) / rect.height
  const distances: Array<[Edge, number]> = [
    ['left', x],
    ['right', 1 - x],
    ['top', y],
    ['bottom', 1 - y],
  ]
  return distances.sort((a, b) => a[1] - b[1])[0][0]
}

const allowed = (rowId: string, candidate: Edge) =>
  Boolean(workbench.activeRow) && canSplit(spaces.active, rowId, workbench.activeRow!.id, candidate)

useDropZone(zone, {
  canDrop: (source) => !source.isFolder && source.rowId !== workbench.activeRow?.id,
  onOver: (source, input) => {
    const candidate = edgeAt(input)
    edge.value = allowed(source.rowId, candidate) ? candidate : null
  },
  onLeave: () => (edge.value = null),
  onDrop: (source, input) => {
    const candidate = edgeAt(input)
    if (allowed(source.rowId, candidate)) actions.splitWithActive(source.rowId, candidate)
  },
})

const active = computed(() =>
  Boolean(dragging.value && workbench.activeRow && !dragging.value.isFolder),
)
const preview = computed(
  () =>
    ({
      left: 'inset-y-2 start-2 w-[calc(50%-0.75rem)]',
      right: 'inset-y-2 end-2 w-[calc(50%-0.75rem)]',
      top: 'inset-x-2 top-2 h-[calc(50%-0.75rem)]',
      bottom: 'inset-x-2 bottom-2 h-[calc(50%-0.75rem)]',
    })[edge.value ?? 'left'],
)
</script>

<template>
  <div ref="zone" class="absolute inset-0 z-30" :class="active ? '' : 'pointer-events-none'">
    <div
      v-if="active && edge"
      class="absolute rounded-lg border-2 border-primary/60 bg-primary/10 transition-all duration-150 ease-out motion-reduce:transition-none"
      :class="preview"
    />
  </div>
</template>
