<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from '@lucide/vue'
import { Kbd } from '@/components/ui/kbd'
import type { Space } from '@/domain/space'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useDropZone } from '@/composables/useRowDnd'
import { endTarget } from '@/composables/useDropGap'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useUi } from '@/stores/ui'
import RowArea from './RowArea.vue'
import SpaceHeader from './SpaceHeader.vue'

/**
 * One space in the sidebar: its name, pinned rows, New tab and temporary
 * rows. Every space keeps its panel mounted; only the active one is live.
 */
const props = defineProps<{ space: Space }>()
const ui = useUi()
const kbd = useShortcutLabel()
const actions = useSidebarActions()

// Dropping on New tab puts the row first among temporary tabs, where new ones open.
const newTab = ref<HTMLElement>()
useDropZone(newTab, {
  target: () => props.space.temporary[0]?.id ?? endTarget('temporary'),
  position: 'before',
  canDrop: (source) => !source.isFolder,
  onDrop: (source) => actions.dropAtStart(source.rowId),
})
</script>

<template>
  <div class="flex min-h-0 flex-col overflow-y-auto px-2">
    <SpaceHeader :space="space" />
    <RowArea area="pinned" :entries="space.pinned" label="Onglets épinglés" />
    <div class="mx-2.5 mb-1.5 h-px bg-hairline" role="separator" />
    <button
      ref="newTab"
      type="button"
      class="row flex h-8 w-full shrink-0 items-center gap-2 px-2 text-[13px] text-ink-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      @click="ui.openCommand({ kind: 'new' })"
    >
      <Plus :size="16" :stroke-width="1.5" />
      <span class="flex-1 text-start">Nouvel onglet</span>
      <Kbd>{{ kbd('newTab') }}</Kbd>
    </button>
    <RowArea
      area="temporary"
      :entries="space.temporary"
      label="Onglets temporaires"
      class="flex-1"
    />
  </div>
</template>
