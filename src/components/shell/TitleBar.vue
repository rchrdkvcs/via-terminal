<script setup lang="ts">
import { PanelLeft } from '@lucide/vue'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import WindowControls from './WindowControls.vue'

/**
 * The strip above the content: where the window is dragged from, and where
 * the window controls are, top right, as Windows and Linux expect them.
 * macOS keeps its own traffic lights on the left.
 */
const settings = useSettings()
const spaces = useSpaces()
const kbd = useShortcutLabel()
</script>

<template>
  <div
    data-tauri-drag-region
    class="flex h-10 shrink-0 items-center gap-1 pe-1"
    :class="!spaces.sidebar.visible && settings.platform === 'macos' ? 'ps-[76px]' : 'ps-1'"
  >
    <button
      v-if="!spaces.sidebar.visible"
      type="button"
      class="press grid size-7 place-items-center rounded-md text-ink-muted outline-none transition-colors duration-100 hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label="Afficher la barre latérale"
      :title="`Barre latérale (${kbd('sidebar')})`"
      @click="spaces.setSidebar({ visible: true })"
    >
      <PanelLeft :size="15" :stroke-width="1.5" />
    </button>
    <div data-tauri-drag-region class="h-full flex-1" />
    <WindowControls v-if="settings.platform !== 'macos'" />
  </div>
</template>
