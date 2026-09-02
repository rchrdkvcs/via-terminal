<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePointerDrag } from '@/composables/usePointerDrag'
import TerminalPane from '@/components/terminal/TerminalPane.vue'
import type { PaneNode } from '@/stores/app'
import { useAppStore } from '@/stores/app'

defineOptions({ name: 'PaneLayout' })

const props = defineProps<{ node: PaneNode; closable: boolean }>()

const store = useAppStore()
const container = ref<HTMLElement>()
const pointerDrag = usePointerDrag()
const dragging = pointerDrag.active

const isVertical = computed(
  () => props.node.kind === 'split' && props.node.direction === 'vertical',
)

/**
 * A split stores a fraction, not pixels, so the ratio survives a window resize
 * and a move to another monitor.
 */
function startDrag(event: PointerEvent) {
  if (props.node.kind !== 'split' || !container.value) return
  const split = props.node
  const bounds = container.value.getBoundingClientRect()
  pointerDrag.start(event, (moveEvent) => {
    const ratio = isVertical.value
      ? (moveEvent.clientX - bounds.left) / bounds.width
      : (moveEvent.clientY - bounds.top) / bounds.height
    store.setSplitRatio(split.id, ratio)
  })
}

/** The splitter is a real slider so it can be moved without a pointer. */
function nudge(step: number) {
  if (props.node.kind !== 'split') return
  store.setSplitRatio(props.node.id, props.node.ratio + step)
}
</script>

<template>
  <TerminalPane
    v-if="node.kind === 'pane'"
    :session-id="node.sessionId"
    :pane-id="node.id"
    :closable="closable"
  />

  <div
    v-else
    ref="container"
    class="flex min-h-0 min-w-0 flex-1"
    :class="isVertical ? 'flex-row' : 'flex-col'"
  >
    <div class="flex min-h-0 min-w-0" :style="{ flex: `${node.ratio} 1 0%` }">
      <PaneLayout :node="node.first" :closable="true" />
    </div>

    <div
      role="separator"
      tabindex="0"
      :aria-label="isVertical ? 'Largeur des panneaux' : 'Hauteur des panneaux'"
      :aria-orientation="isVertical ? 'vertical' : 'horizontal'"
      :aria-valuenow="Math.round(node.ratio * 100)"
      aria-valuemin="15"
      aria-valuemax="85"
      class="group relative z-10 shrink-0 focus-visible:outline-none"
      :class="[isVertical ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize']"
      @pointerdown.prevent="startDrag"
      @keydown.left.prevent="isVertical && nudge(-0.02)"
      @keydown.right.prevent="isVertical && nudge(0.02)"
      @keydown.up.prevent="!isVertical && nudge(-0.02)"
      @keydown.down.prevent="!isVertical && nudge(0.02)"
    >
      <!-- The 8px splitter is also the visual gap between the two terminal cards. -->
      <span
        class="absolute rounded-full transition-colors duration-150 group-hover:bg-ring group-focus-visible:bg-ring"
        :class="[
          isVertical
            ? 'inset-y-0 left-1/2 w-px -translate-x-1/2'
            : 'inset-x-0 top-1/2 h-px -translate-y-1/2',
          dragging ? 'bg-ring' : 'bg-transparent',
        ]"
        aria-hidden="true"
      />
    </div>

    <div class="flex min-h-0 min-w-0" :style="{ flex: `${1 - node.ratio} 1 0%` }">
      <PaneLayout :node="node.second" :closable="true" />
    </div>
  </div>
</template>
