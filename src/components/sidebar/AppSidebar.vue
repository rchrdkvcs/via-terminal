<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from '@lucide/vue'
import { Kbd } from '@/components/ui/kbd'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useDropZone } from '@/composables/useRowDnd'
import { endTarget } from '@/composables/useDropGap'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import AddressPill from './AddressPill.vue'
import RowArea from './RowArea.vue'
import SidebarTop from './SidebarTop.vue'
import SpaceHeader from './SpaceHeader.vue'
import SpaceSwitcher from './SpaceSwitcher.vue'

/**
 * Top to bottom: title bar, address, the space's pinned rows, New tab, the
 * temporary rows, and the space switcher.
 */
const spaces = useSpaces()
const ui = useUi()
const kbd = useShortcutLabel()
const actions = useSidebarActions()

// Dropping on New tab puts the row first among temporary tabs, where new ones open.
const newTab = ref<HTMLElement>()
useDropZone(newTab, {
  target: () => spaces.active.temporary[0]?.id ?? endTarget('temporary'),
  position: 'before',
  canDrop: (source) => !source.isFolder,
  onDrop: (source) => actions.dropAtStart(source.rowId),
})

let wheelLock = 0
function onWheel(event: WheelEvent) {
  const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.5
  if (!event.ctrlKey && !horizontal) return
  event.preventDefault()
  const now = performance.now()
  if (now - wheelLock < 350) return
  wheelLock = now
  const delta = horizontal ? event.deltaX : event.deltaY
  spaces.cycle(delta > 0 ? 1 : -1)
}
</script>

<template>
  <aside class="flex h-full min-h-0 flex-col" aria-label="Barre latérale" @wheel="onWheel">
    <SidebarTop />
    <div class="px-2 pb-2">
      <AddressPill />
    </div>
    <div :key="spaces.active.id" class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2">
      <SpaceHeader />
      <RowArea area="pinned" :entries="spaces.active.pinned" label="Onglets épinglés" />
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
        :entries="spaces.active.temporary"
        label="Onglets temporaires"
        class="flex-1"
      />
    </div>
    <div class="p-2 pt-1">
      <SpaceSwitcher />
    </div>
  </aside>
</template>
