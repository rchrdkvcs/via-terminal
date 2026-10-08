<script setup lang="ts">
import { ref } from 'vue'
import ResizeHandle from '@/components/ui/resize-handle/ResizeHandle.vue'
import { useSpaces } from '@/stores/spaces'

const spaces = useSpaces()
const clamp = (value: number) => Math.round(Math.min(480, Math.max(200, value)))

const dragging = ref(false)

function start(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const origin = event.clientX
  const initial = spaces.sidebar.width
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  dragging.value = true
  const move = (moveEvent: PointerEvent) => {
    const next = initial + moveEvent.clientX - origin
    if (next < 140) spaces.setSidebar({ visible: false, width: initial })
    else spaces.setSidebar({ width: clamp(next) })
  }
  const stop = () => {
    dragging.value = false
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', stop)
    target.removeEventListener('lostpointercapture', stop)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', stop)
  target.addEventListener('lostpointercapture', stop)
}

function nudge(delta: number) {
  spaces.setSidebar({ width: clamp(spaces.sidebar.width + delta) })
}
</script>

<template>
  <ResizeHandle
    :data-dragging="dragging"
    role="separator"
    aria-orientation="vertical"
    aria-label="Largeur de la barre latérale"
    :aria-valuenow="spaces.sidebar.width"
    aria-valuemin="200"
    aria-valuemax="480"
    tabindex="0"
    class="absolute inset-y-0 -end-1.5 z-20"
    @pointerdown="start"
    @keydown.left.prevent="nudge(-16)"
    @keydown.right.prevent="nudge(16)"
  />
</template>
