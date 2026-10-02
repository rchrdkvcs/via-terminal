<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useWindowSize } from '@vueuse/core'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import SidebarResizer from './SidebarResizer.vue'

/**
 * Kept, the sidebar sits beside the content. Hidden, resting on the left
 * edge reveals it floating over the content, so xterm never refits.
 */
const spaces = useSpaces()
const ui = useUi()
const { width: windowWidth } = useWindowSize()
const width = computed(() => Math.min(spaces.sidebar.width, Math.max(200, windowWidth.value * 0.4)))

let reveal: ReturnType<typeof setTimeout> | undefined
let hide: ReturnType<typeof setTimeout> | undefined
function enter() {
  clearTimeout(hide)
  if (!ui.peek) reveal = setTimeout(() => (ui.peek = true), 120)
}
function leave() {
  clearTimeout(reveal)
  // Menus open from the peek live in a portal; keep it up while one is open.
  hide = setTimeout(() => {
    if (document.querySelector('[data-slot$="menu-content"], [role="menu"]')) return leave()
    ui.peek = false
  }, 280)
}
onBeforeUnmount(() => (clearTimeout(reveal), clearTimeout(hide)))
</script>

<template>
  <div
    v-if="spaces.sidebar.visible"
    class="relative h-full shrink-0"
    :style="{ width: `${width}px` }"
  >
    <AppSidebar />
    <SidebarResizer />
  </div>
  <div
    v-else
    class="absolute inset-y-0 start-0 z-40"
    :style="{ width: ui.peek ? `${width + 8}px` : '10px' }"
    @pointerenter="enter"
    @pointerleave="leave"
  >
    <Transition
      enter-active-class="transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
      enter-from-class="-translate-x-[calc(100%+8px)]"
      leave-active-class="transition-transform duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="-translate-x-[calc(100%+8px)]"
    >
      <div
        v-if="ui.peek"
        class="absolute inset-y-1.5 start-1.5 overflow-hidden rounded-xl bg-chrome shadow-2xl ring-1 ring-border"
        :style="{ width: `${width}px` }"
      >
        <AppSidebar />
      </div>
    </Transition>
  </div>
</template>
