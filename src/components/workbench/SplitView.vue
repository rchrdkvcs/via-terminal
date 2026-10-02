<script setup lang="ts">
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { Split } from '@/ipc/types'
import { useSpaces } from '@/stores/spaces'
import TabPane from './TabPane.vue'

/** Two to four tabs side by side; sizes persist with the row. */
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
    class="gap-0 p-1.5"
    @layout="onLayout"
  >
    <template v-for="(tab, index) in split.tabs" :key="tab.id">
      <ResizableHandle
        v-if="index > 0"
        class="mx-0.5 w-1 bg-transparent data-[orientation=vertical]:my-0.5 data-[orientation=vertical]:h-1"
      />
      <ResizablePanel :default-size="percent(index)" :min-size="12">
        <TabPane :tab="tab" in-split />
      </ResizablePanel>
    </template>
  </ResizablePanelGroup>
</template>
