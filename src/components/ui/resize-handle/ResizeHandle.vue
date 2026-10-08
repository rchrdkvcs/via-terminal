<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<PrimitiveProps & { class?: HTMLAttributes['class'] }>(), {
  as: 'div',
})
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    data-slot="resize-handle"
    :class="cn('relative resize-handle', props.class)"
  >
    <span class="resize-grip" aria-hidden="true" />
  </Primitive>
</template>

<style scoped>
.resize-handle {
  display: flex;
  width: 8px;
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
  height: 8px;
  cursor: ns-resize;
}

.resize-grip {
  width: 3px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--color-ink-faint);
  opacity: 0.4;
  transition:
    opacity 100ms ease-out,
    background-color 100ms ease-out;
  pointer-events: none;
}

[data-orientation='vertical'] > .resize-grip {
  width: 32px;
  height: 3px;
}

.resize-handle:hover > .resize-grip,
.resize-handle:focus-visible > .resize-grip,
.resize-handle:active > .resize-grip,
.resize-handle[data-state='dragging'] > .resize-grip,
.resize-handle[data-dragging='true'] > .resize-grip {
  background: var(--color-ring);
  opacity: 1;
}

.resize-handle:focus-visible > .resize-grip {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .resize-grip {
    transition: none;
  }
}
</style>
