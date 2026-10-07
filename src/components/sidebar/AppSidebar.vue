<script setup lang="ts">
import { ref } from 'vue'
import { useSpaces } from '@/stores/spaces'
import SidebarTop from './SidebarTop.vue'
import SpacePanel from './SpacePanel.vue'
import SpaceSwitcher from './SpaceSwitcher.vue'
import { useSpaceTrack } from './useSpaceTrack'

/**
 * Top to bottom: title bar, the active space (pinned rows, New tab, the
 * temporary rows), and the space switcher.
 */
const spaces = useSpaces()
const sidebar = ref<HTMLElement>()
const { onWheel, place, moving } = useSpaceTrack(sidebar)
</script>

<template>
  <aside
    ref="sidebar"
    class="flex h-full min-h-0 flex-col"
    aria-label="Barre latérale"
    @wheel="onWheel"
  >
    <SidebarTop />
    <!-- Spaces sit side by side; a swipe pulls the next one in from its side. -->
    <div class="track grid min-h-0 flex-1" data-space-track>
      <SpacePanel
        v-for="space in spaces.spaces"
        :key="space.id"
        :space="space"
        :data-space-panel="space.id"
        :data-active="space.id === spaces.active.id || undefined"
        :inert="space.id !== spaces.active.id"
        :aria-hidden="space.id !== spaces.active.id ? 'true' : undefined"
        class="[grid-area:1/1]"
        :class="[
          place(space.id) === null ? 'invisible' : '',
          moving ? 'will-change-transform' : '',
        ]"
        :style="{ transform: place(space.id) ?? undefined }"
      />
    </div>
    <div class="p-2 pt-1">
      <SpaceSwitcher />
    </div>
  </aside>
</template>

<style scoped>
.track {
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  [data-active] {
    animation: space-fade 150ms linear;
  }
}

@keyframes space-fade {
  from {
    opacity: 0;
  }
}
</style>
