<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { Kbd } from '@/components/ui/kbd'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
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
    <Transition
      mode="out-in"
      enter-active-class="transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-x-2"
      leave-active-class="transition-opacity duration-100 motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <div
        :key="spaces.active.id"
        class="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-2"
      >
        <SpaceHeader />
        <RowArea area="pinned" :entries="spaces.active.pinned" label="Onglets épinglés" />
        <div class="mx-2 mb-1 h-px bg-border" role="separator" />
        <button
          type="button"
          class="flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-row-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          @click="ui.openCommand({ kind: 'new' })"
        >
          <Plus :size="16" :stroke-width="1.5" />
          <span class="flex-1 text-start">Nouvel onglet</span>
          <Kbd class="opacity-70">{{ kbd('newTab') }}</Kbd>
        </button>
        <RowArea
          area="temporary"
          :entries="spaces.active.temporary"
          label="Onglets temporaires"
          class="flex-1"
        />
      </div>
    </Transition>
    <div class="p-2 pt-1">
      <SpaceSwitcher />
    </div>
  </aside>
</template>
