<script setup lang="ts">
import TerminalPane from '@/components/terminal/TerminalPane.vue'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { PaneNode } from '@/domain/layout'
import { useAppStore } from '@/stores/app'

defineOptions({ name: 'PaneLayout' })

const props = defineProps<{ node: PaneNode; closable: boolean }>()

const store = useAppStore()
function saveLayout(layout: number[]) {
  if (props.node.kind === 'split' && layout[0] !== undefined)
    store.setSplitRatio(props.node.id, layout[0] / 100)
}
</script>

<template>
  <TerminalPane
    v-if="node.kind === 'pane'"
    :session-id="node.sessionId"
    :pane-id="node.id"
    :closable="closable"
  />

  <ResizablePanelGroup
    v-else
    :key="node.id"
    :direction="node.direction === 'vertical' ? 'horizontal' : 'vertical'"
    class="min-h-0 min-w-0 flex-1"
    @layout="saveLayout"
  >
    <ResizablePanel class="flex min-h-0 min-w-0" :default-size="node.ratio * 100" :min-size="15">
      <PaneLayout :node="node.first" :closable="true" />
    </ResizablePanel>
    <ResizableHandle
      class="mx-1 data-[orientation=vertical]:my-1"
      :aria-label="node.direction === 'vertical' ? 'Largeur des panneaux' : 'Hauteur des panneaux'"
    />
    <ResizablePanel
      class="flex min-h-0 min-w-0"
      :default-size="(1 - node.ratio) * 100"
      :min-size="15"
    >
      <PaneLayout :node="node.second" :closable="true" />
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
