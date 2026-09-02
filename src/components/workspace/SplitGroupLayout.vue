<script setup lang="ts">
import { computed } from 'vue'
import PaneLayout from './PaneLayout.vue'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { RuntimeSplitTree } from '@/stores/app'
import { useAppStore } from '@/stores/app'

defineOptions({ name: 'SplitGroupLayout' })
const props = defineProps<{ node: RuntimeSplitTree }>()
const store = useAppStore()
const isVertical = computed(
  () => props.node.kind === 'split' && props.node.direction === 'vertical',
)
const tab = computed(() => {
  const node = props.node
  return node.kind === 'tab' ? store.tabs.find((item) => item.id === node.tabId) : null
})

function saveLayout(layout: number[]) {
  if (props.node.kind === 'split' && layout[0] !== undefined)
    store.setGroupSplitRatio(props.node.id, layout[0] / 100)
}
</script>

<template>
  <PaneLayout v-if="node.kind === 'tab' && tab" :node="tab.root" :closable="true" />
  <ResizablePanelGroup
    v-else-if="node.kind === 'split'"
    :key="node.id"
    :direction="isVertical ? 'horizontal' : 'vertical'"
    class="min-h-0 min-w-0 flex-1"
    @layout="saveLayout"
  >
    <ResizablePanel class="flex min-h-0 min-w-0" :default-size="node.ratio * 100" :min-size="15">
      <SplitGroupLayout :node="node.first" />
    </ResizablePanel>
    <ResizableHandle
      class="mx-1 data-[orientation=vertical]:my-1"
      :aria-label="isVertical ? 'Largeur des panneaux' : 'Hauteur des panneaux'"
    />
    <ResizablePanel
      class="flex min-h-0 min-w-0"
      :default-size="(1 - node.ratio) * 100"
      :min-size="15"
    >
      <SplitGroupLayout :node="node.second" />
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
