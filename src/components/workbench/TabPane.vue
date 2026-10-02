<script setup lang="ts">
import { computed } from 'vue'
import type { Tab } from '@/ipc/types'
import { useWorkbench } from '@/stores/workbench'
import ConnectionPanel from './ConnectionPanel.vue'
import TerminalHost from './TerminalHost.vue'

/** One tab's terminal, with its connection state laid over it when needed. */
const props = defineProps<{ tab: Tab; inSplit?: boolean }>()
const workbench = useWorkbench()
const focused = computed(() => workbench.activeTab?.id === props.tab.id)
</script>

<template>
  <div
    class="relative h-full min-h-0 w-full min-w-0 overflow-hidden"
    :class="inSplit ? 'rounded-lg' : ''"
    :data-focused="focused || undefined"
    :aria-label="inSplit ? 'Volet' : undefined"
    @pointerdown="!focused && workbench.activate(tab.id)"
  >
    <div
      v-if="inSplit"
      class="pointer-events-none absolute inset-0 z-20 rounded-lg ring-1 ring-inset transition-[box-shadow] duration-150"
      :class="focused ? 'ring-primary/45' : 'ring-border'"
      aria-hidden="true"
    />
    <div class="absolute inset-0 py-2 ps-3 pe-1">
      <TerminalHost :tab-id="tab.id" />
    </div>
    <ConnectionPanel :tab="tab" />
  </div>
</template>
