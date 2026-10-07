<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, nextTick } from 'vue'
import { useFiles } from '@/stores/files'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useWorkbench } from '@/stores/workbench'
import EmptyWorkbench from './EmptyWorkbench.vue'
import SplitDropZones from './SplitDropZones.vue'
import SplitView from './SplitView.vue'
import TabPane from './TabPane.vue'
import TerminalSearch from './TerminalSearch.vue'

const workbench = useWorkbench()
const files = useFiles()
const FilePanel = defineAsyncComponent(() => import('@/components/files/FilePanel.vue'))
const panel = computed(() =>
  workbench.activeTab?.target.kind !== 'local' && workbench.activeTab
    ? files.state(workbench.activeTab.id)
    : null,
)
const filePane = ref<{ resize: (size: number) => void }>()
let previousSizes = [60, 40]
function layout(sizes: number[]) {
  if (sizes.length === 2) previousSizes = sizes
}
const shown = computed(() => !!panel.value?.visible)
const expanded = computed(() => shown.value && panel.value?.expanded)
watch(shown, async (visible) => {
  const size = previousSizes[1]
  await nextTick()
  if (visible) filePane.value?.resize(size)
})
</script>

<template>
  <ResizablePanelGroup @layout="layout" direction="horizontal" class="relative h-full min-h-0">
    <ResizablePanel :min-size="20" :class="expanded ? '!hidden' : !shown ? '!flex-[1_1_100%]' : ''">
      <div class="relative h-full min-h-0">
        <EmptyWorkbench v-if="!workbench.activeRow" class="rounded-xl bg-surface shadow-surface" />
        <SplitView v-else-if="workbench.activeRow.kind === 'split'" :split="workbench.activeRow" />
        <TabPane v-else :key="workbench.activeRow.id" :tab="workbench.activeRow" />
        <SplitDropZones />
        <TerminalSearch />
      </div>
    </ResizablePanel>
    <template v-if="shown && workbench.activeTab">
      <ResizableHandle
        v-show="!expanded"
        class="w-2 shrink-0"
        aria-label="Redimensionner l’explorateur distant"
      />
      <ResizablePanel
        ref="filePane"
        :default-size="40"
        :min-size="30"
        class="overflow-hidden rounded-xl bg-rail shadow-surface"
        :class="expanded ? '!flex-[1_1_100%]' : ''"
      >
        <FilePanel :tab="workbench.activeTab" />
      </ResizablePanel>
    </template>
  </ResizablePanelGroup>
</template>
