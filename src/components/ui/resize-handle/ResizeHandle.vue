<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { onBeforeUnmount, ref } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<PrimitiveProps & { class?: HTMLAttributes['class'] }>(), {
  as: 'div',
})

// While dragging, the pointer leaves the thin hit area: lock the cursor and text
// selection on the whole document so nothing underneath flickers or reacts.
const active = ref(false)

function release() {
  if (!active.value) return
  active.value = false
  delete document.documentElement.dataset.resizing
  window.removeEventListener('pointerup', release, true)
  window.removeEventListener('pointercancel', release, true)
  window.removeEventListener('blur', release)
}

function engage(event: PointerEvent) {
  if (event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  const rows = element.dataset.orientation === 'vertical'
  document.documentElement.dataset.resizing = rows ? 'y' : 'x'
  active.value = true
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
  window.addEventListener('blur', release)
}

onBeforeUnmount(release)
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    data-slot="resize-handle"
    :data-active="active || undefined"
    :class="cn('relative resize-handle', props.class)"
    @pointerdown="engage"
  >
    <span class="resize-grip" aria-hidden="true" />
  </Primitive>
</template>

<style scoped>
.resize-handle {
  --grip-length: min(50vh, calc(100% - 16px));
  display: flex;
  width: 9px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
  touch-action: none;
  user-select: none;
  outline: none;
}

/* Reka names the split direction: a vertical split has a horizontal separator. */
.resize-handle[data-orientation='vertical'] {
  width: 100%;
  height: 9px;
  cursor: ns-resize;
}

.resize-grip {
  width: 2px;
  height: var(--grip-length);
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--color-ring);
  opacity: 0;
  transform: scaleY(0.6);
  transition:
    opacity 200ms var(--ease-out),
    transform 260ms var(--ease-out);
  pointer-events: none;
  will-change: transform, opacity;
}

[data-orientation='vertical'] > .resize-grip {
  width: var(--grip-length);
  height: 2px;
  transform: scaleX(0.6);
}

/* Brief delay on hover so the grip does not flash when the pointer just passes by. */
.resize-handle:hover > .resize-grip {
  opacity: 1;
  transform: none;
  transition-delay: 80ms;
}

.resize-handle:focus-visible > .resize-grip,
.resize-handle[data-active] > .resize-grip,
.resize-handle[data-state='drag'] > .resize-grip,
.resize-handle[data-dragging='true'] > .resize-grip {
  opacity: 1;
  transform: none;
  transition-delay: 0ms;
}

.resize-handle:focus-visible > .resize-grip {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .resize-grip,
  [data-orientation='vertical'] > .resize-grip {
    transform: none;
    transition: opacity 100ms linear;
  }
}
</style>

<style>
:root[data-resizing],
:root[data-resizing] * {
  user-select: none !important;
}

:root[data-resizing='x'] * {
  cursor: ew-resize !important;
}

:root[data-resizing='y'] * {
  cursor: ns-resize !important;
}

/* Terminals and webviews underneath must not steal or react to the drag. */
:root[data-resizing] :is(iframe, canvas, .xterm) {
  pointer-events: none;
}
</style>
