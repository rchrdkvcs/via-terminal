<script setup lang="ts">
import { computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import { useSpaces } from '@/stores/spaces'
import SidebarResizer from './SidebarResizer.vue'

const spaces = useSpaces()
const { width: windowWidth } = useWindowSize()
const width = computed(() => Math.min(spaces.sidebar.width, Math.max(200, windowWidth.value * 0.4)))
</script>

<template>
  <!-- Width animates only on show/hide; the content keeps its full width and is clipped, so it never reflows mid-transition. -->
  <Transition
    enter-active-class="transition-[width,opacity] duration-200 ease-[var(--ease-drawer)] motion-reduce:transition-none"
    enter-from-class="w-0! opacity-0"
    leave-active-class="transition-[width,opacity] duration-150 ease-[var(--ease-drawer)] motion-reduce:transition-none"
    leave-to-class="w-0! opacity-0"
  >
    <div
      v-if="spaces.sidebar.visible"
      class="relative h-full shrink-0"
      :style="{ width: `${width}px` }"
    >
      <div class="h-full overflow-hidden">
        <div class="h-full" :style="{ width: `${width}px` }">
          <AppSidebar />
        </div>
      </div>
      <SidebarResizer />
    </div>
  </Transition>
</template>
