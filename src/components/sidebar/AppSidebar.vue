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
import { createSpaceSwipe } from './spaceSwipe'

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

const onWheel = createSpaceSwipe(spaces.cycle)
</script>

<template>
  <aside class="flex h-full min-h-0 flex-col" aria-label="Barre latérale" @wheel="onWheel">
    <SidebarTop />
    <div class="px-2 pb-2">
      <AddressPill />
    </div>
    <!-- Spaces sit on a carousel: the next one turns in from the side it lies on. -->
    <div class="carousel grid min-h-0 flex-1" :style="{ '--dir': spaces.switchDirection }">
      <Transition name="space">
        <div
          :key="spaces.active.id"
          class="flex min-h-0 flex-col overflow-y-auto px-2 [grid-area:1/1]"
        >
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
      </Transition>
    </div>
    <div class="p-2 pt-1">
      <SpaceSwitcher />
    </div>
  </aside>
</template>

<style scoped>
.carousel {
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  overflow: hidden;
  perspective: 900px;
}

.space-enter-active,
.space-leave-active {
  transition:
    transform 300ms var(--ease-out),
    opacity 300ms var(--ease-out);
  backface-visibility: hidden;
}

.space-leave-active {
  pointer-events: none;
}

.space-enter-from {
  opacity: 0;
  transform: translateX(calc(var(--dir) * 45%)) rotateY(calc(var(--dir) * 24deg));
}

.space-leave-to {
  opacity: 0;
  transform: translateX(calc(var(--dir) * -45%)) rotateY(calc(var(--dir) * -24deg));
}

@media (prefers-reduced-motion: reduce) {
  .space-enter-active,
  .space-leave-active {
    transition: opacity 150ms linear;
  }

  .space-enter-from,
  .space-leave-to {
    transform: none;
  }
}
</style>
