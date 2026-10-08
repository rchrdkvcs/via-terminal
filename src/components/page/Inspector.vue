<script setup lang="ts">
import { ref } from 'vue'
import ResizeHandle from '@/components/ui/resize-handle/ResizeHandle.vue'
import { useLocalStorage } from '@vueuse/core'

defineProps<{ label: string }>()
const MIN = 340
const MAX = 680
const width = useLocalStorage('via.inspector.width', 380)
const clamp = (value: number) => Math.round(Math.min(MAX, Math.max(MIN, value)))

const dragging = ref(false)

function resize(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const handle = event.currentTarget as HTMLElement
  const origin = event.clientX
  const initial = width.value
  handle.setPointerCapture(event.pointerId)
  dragging.value = true
  const move = (next: PointerEvent) => (width.value = clamp(initial + origin - next.clientX))
  const stop = () => {
    dragging.value = false
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', stop)
    handle.removeEventListener('lostpointercapture', stop)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', stop)
  handle.addEventListener('lostpointercapture', stop)
}
</script>

<template>
  <aside
    :aria-label="label"
    class="material-panel relative my-2 me-2 flex shrink-0 flex-col overflow-hidden rounded-xl"
    :style="{ width: `${clamp(width)}px` }"
  >
    <ResizeHandle
      :data-dragging="dragging"
      role="separator"
      aria-orientation="vertical"
      aria-label="Largeur du panneau"
      :aria-valuenow="clamp(width)"
      :aria-valuemin="MIN"
      :aria-valuemax="MAX"
      tabindex="0"
      class="absolute inset-y-0 start-0 z-10"
      @pointerdown="resize"
      @dblclick="width = 380"
      @keydown.left.prevent="width = clamp(width + 24)"
      @keydown.right.prevent="width = clamp(width - 24)"
    />
    <slot />
  </aside>
</template>
