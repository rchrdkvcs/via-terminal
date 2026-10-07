<script setup lang="ts">
import { useWorkbench } from '@/stores/workbench'
import EmptyWorkbench from './EmptyWorkbench.vue'
import SplitDropZones from './SplitDropZones.vue'
import SplitView from './SplitView.vue'
import TabPane from './TabPane.vue'
import TerminalSearch from './TerminalSearch.vue'

const workbench = useWorkbench()
</script>

<template>
  <div class="relative h-full min-h-0">
    <EmptyWorkbench v-if="!workbench.activeRow" />
    <SplitView v-else-if="workbench.activeRow.kind === 'split'" :split="workbench.activeRow" />
    <TabPane v-else :key="workbench.activeRow.id" :tab="workbench.activeRow" />
    <SplitDropZones />
    <TerminalSearch />
  </div>
</template>
