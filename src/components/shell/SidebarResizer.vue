<script setup lang="ts">
import { useSpaces } from '@/stores/spaces'

/** Drag to resize, double-click to reset, arrows when focused. */
const spaces = useSpaces()
const DEFAULT = 264
const clamp = (value: number) => Math.round(Math.min(480, Math.max(200, value)))

function start(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const origin = event.clientX
  const initial = spaces.sidebar.width
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  const move = (moveEvent: PointerEvent) => {
    const next = initial + moveEvent.clientX - origin
    if (next < 140) spaces.setSidebar({ visible: false, width: initial })
    else spaces.setSidebar({ width: clamp(next) })
  }
  const stop = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', stop)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', stop)
}

function nudge(delta: number) {
  spaces.setSidebar({ width: clamp(spaces.sidebar.width + delta) })
}
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Largeur de la barre latérale"
    :aria-valuenow="spaces.sidebar.width"
    aria-valuemin="200"
    aria-valuemax="480"
    tabindex="0"
    class="group absolute inset-y-0 -end-1.5 z-20 w-2 cursor-ew-resize outline-none"
    @pointerdown="start"
    @dblclick="spaces.setSidebar({ width: DEFAULT })"
    @keydown.left.prevent="nudge(-16)"
    @keydown.right.prevent="nudge(16)"
  >
    <span
      class="absolute inset-y-[20%] start-1/2 w-px bg-border opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
    />
  </div>
</template>
