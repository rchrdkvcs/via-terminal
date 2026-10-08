<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { Tab } from '@/ipc/types'
import { useWorkbench } from '@/stores/workbench'
import ConnectionPanel from './ConnectionPanel.vue'
import TerminalHost from './TerminalHost.vue'

const FilePanel = defineAsyncComponent(() => import('@/components/files/FilePanel.vue'))
const DocumentEditor = defineAsyncComponent(() => import('@/components/files/DocumentEditor.vue'))

const props = defineProps<{ tab: Tab; inSplit?: boolean }>()
const workbench = useWorkbench()
const focused = computed(() => workbench.activeTab?.id === props.tab.id)
</script>

<template>
  <div
    class="relative h-full min-h-0 w-full min-w-0 overflow-hidden rounded-xl bg-surface shadow-surface"
    :data-focused="focused || undefined"
    :aria-label="inSplit ? 'Volet' : undefined"
    @pointerdown="!focused && workbench.activate(tab.id)"
  >
    <div
      v-if="inSplit"
      class="pointer-events-none absolute inset-0 z-20 rounded-xl ring-1 ring-border ring-inset"
      aria-hidden="true"
    />
    <FilePanel v-if="tab.view?.kind === 'files'" :tab="tab" />
    <DocumentEditor
      v-else-if="tab.view?.kind === 'document'"
      :tab-id="tab.id"
      :path="tab.view.path"
    />
    <div v-else class="absolute inset-0 py-2 ps-3 pe-1">
      <TerminalHost :tab-id="tab.id" />
    </div>
    <ConnectionPanel :tab="tab" />
  </div>
</template>
