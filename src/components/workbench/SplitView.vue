<script setup lang="ts">
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { Split } from '@/ipc/types'
import { useSpaces } from '@/stores/spaces'
import TabPane from './TabPane.vue'

const props = defineProps<{ split: Split }>()
const spaces = useSpaces()

function percent(index: number) {
  const total = props.split.sizes.reduce((sum, size) => sum + size, 0)
  return (props.split.sizes[index] / total) * 100
}

function onLayout(sizes: number[]) {
  if (sizes.length !== props.split.tabs.length) return
  spaces.dispatch({
    type: 'resize',
    splitId: props.split.id,
    sizes: sizes.map((size) => size / 100),
  })
}
</script>

<template>
  <ResizablePanelGroup
    :key="split.tabs.map((tab) => tab.id).join()"
    :direction="split.direction"
    class="min-h-0 min-w-0"
    @layout="onLayout"
  >
    <template v-for="(tab, index) in split.tabs" :key="tab.id">
      <ResizableHandle
        v-if="index > 0"
        class="w-2 shrink-0 data-[orientation=vertical]:h-2"
        aria-label="Redimensionner les terminaux"
      />
      <ResizablePanel :default-size="percent(index)" :min-size="12">
        <TabPane :tab="tab" in-split />
      </ResizablePanel>
    </template>
  </ResizablePanelGroup>
</template>
