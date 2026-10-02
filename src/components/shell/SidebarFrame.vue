<script setup lang="ts">
import { computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import { useSpaces } from '@/stores/spaces'
import SidebarResizer from './SidebarResizer.vue'

/** The sidebar beside the content, shown or hidden with its shortcut. */
const spaces = useSpaces()
const { width: windowWidth } = useWindowSize()
const width = computed(() => Math.min(spaces.sidebar.width, Math.max(200, windowWidth.value * 0.4)))
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
</template>
