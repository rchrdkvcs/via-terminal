<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

/**
 * A detail panel floating over the page's right edge, like a sheet. Its
 * width follows the left edge when dragged and is remembered.
 */
defineProps<{ label: string }>()
const MIN = 340
const MAX = 680
const width = useLocalStorage('via.inspector.width', 380)
const clamp = (value: number) => Math.round(Math.min(MAX, Math.max(MIN, value)))

function resize(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const handle = event.currentTarget as HTMLElement
  const origin = event.clientX
  const initial = width.value
  handle.setPointerCapture(event.pointerId)
  const move = (next: PointerEvent) => (width.value = clamp(initial + origin - next.clientX))
  const stop = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', stop)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', stop)
}
</script>

<template>
  <aside
    :aria-label="label"
    class="material-panel relative my-2 me-2 flex shrink-0 flex-col overflow-hidden rounded-xl"
    :style="{ width: `${clamp(width)}px` }"
  >
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Largeur du panneau"
      tabindex="0"
      class="group absolute inset-y-0 start-0 z-10 w-2 cursor-ew-resize outline-none"
      @pointerdown="resize"
      @dblclick="width = 380"
      @keydown.left.prevent="width = clamp(width + 24)"
      @keydown.right.prevent="width = clamp(width - 24)"
    >
      <span
        class="absolute inset-y-[30%] start-0.5 w-[3px] rounded-full bg-ink-faint/40 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </div>
    <slot />
  </aside>
</template>
