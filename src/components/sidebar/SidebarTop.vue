<script setup lang="ts">
import { PanelLeft } from '@lucide/vue'
import WindowControls from '@/components/shell/WindowControls.vue'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'

/** The window's title bar lives in the sidebar, as in Arc. */
const settings = useSettings()
const spaces = useSpaces()
const kbd = useShortcutLabel()
</script>

<template>
  <div
    data-tauri-drag-region
    class="flex h-10 shrink-0 items-center gap-1 px-1"
    :class="settings.platform === 'macos' ? 'ps-[76px]' : ''"
  >
    <button
      type="button"
      class="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-row-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      :aria-label="
        spaces.sidebar.visible ? 'Masquer la barre latérale' : 'Garder la barre latérale'
      "
      :title="`Barre latérale (${kbd('sidebar')})`"
      @click="spaces.setSidebar({ visible: !spaces.sidebar.visible })"
    >
      <PanelLeft :size="15" :stroke-width="1.5" />
    </button>
    <div data-tauri-drag-region class="h-full flex-1" />
    <WindowControls v-if="settings.platform !== 'macos'" />
  </div>
</template>
