<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePointerDrag } from '@/composables/usePointerDrag'
import PaneLayout from './PaneLayout.vue'
import type { RuntimeSplitTree } from '@/stores/app'
import { useAppStore } from '@/stores/app'

defineOptions({ name: 'SplitGroupLayout' })
const props = defineProps<{ node: RuntimeSplitTree }>()
const store = useAppStore()
const container = ref<HTMLElement>()
const pointerDrag = usePointerDrag()
const isVertical = computed(
  () => props.node.kind === 'split' && props.node.direction === 'vertical',
)
const tab = computed(() => {
  const node = props.node
  return node.kind === 'tab' ? store.tabs.find((item) => item.id === node.tabId) : null
})

function startDrag(event: PointerEvent) {
  if (props.node.kind !== 'split' || !container.value) return
  const split = props.node
  const bounds = container.value.getBoundingClientRect()
  pointerDrag.start(event, (moveEvent) => {
    const ratio = isVertical.value
      ? (moveEvent.clientX - bounds.left) / bounds.width
      : (moveEvent.clientY - bounds.top) / bounds.height
    store.setGroupSplitRatio(split.id, ratio)
  })
}

function resizeWithKeyboard(event: KeyboardEvent) {
  if (props.node.kind !== 'split') return
  const decrease = isVertical.value ? event.key === 'ArrowLeft' : event.key === 'ArrowUp'
  const increase = isVertical.value ? event.key === 'ArrowRight' : event.key === 'ArrowDown'
  if (!decrease && !increase) return
  event.preventDefault()
  store.setGroupSplitRatio(props.node.id, props.node.ratio + (increase ? 0.05 : -0.05))
}
</script>

<template>
  <PaneLayout v-if="node.kind === 'tab' && tab" :node="tab.root" :closable="true" />
  <div
    v-else-if="node.kind === 'split'"
    ref="container"
    class="flex min-h-0 min-w-0 flex-1"
    :class="isVertical ? 'flex-row' : 'flex-col'"
  >
    <div class="flex min-h-0 min-w-0" :style="{ flex: `${node.ratio} 1 0%` }">
      <SplitGroupLayout :node="node.first" />
    </div>
    <div
      role="separator"
      tabindex="0"
      :aria-label="isVertical ? 'Largeur des panneaux' : 'Hauteur des panneaux'"
      :aria-orientation="isVertical ? 'vertical' : 'horizontal'"
      :aria-valuenow="Math.round(node.ratio * 100)"
      aria-valuemin="15"
      aria-valuemax="85"
      class="relative shrink-0 bg-border transition-colors duration-150 hover:bg-ring focus-visible:bg-ring focus-visible:outline-2 focus-visible:outline-ring"
      :class="isVertical ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'"
      @pointerdown.prevent="startDrag"
      @keydown="resizeWithKeyboard"
    >
      <span
        class="absolute"
        :class="isVertical ? '-inset-x-1.5 inset-y-0' : 'inset-x-0 -inset-y-1.5'"
        aria-hidden="true"
      />
    </div>
    <div class="flex min-h-0 min-w-0" :style="{ flex: `${1 - node.ratio} 1 0%` }">
      <SplitGroupLayout :node="node.second" />
    </div>
  </div>
</template>
