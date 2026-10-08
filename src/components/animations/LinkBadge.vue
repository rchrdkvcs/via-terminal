<script setup lang="ts">
import type { SessionScene } from '@/domain/session-scene'

defineProps<{ scene: SessionScene }>()

const SHIELD = 'M0 -4.5 L3.6 -3 V0.4 C3.6 2.6 2 4 0 4.8 C-2 4 -3.6 2.6 -3.6 0.4 V-3 Z'
</script>

<template>
  <Transition name="badge">
    <g v-if="scene === 'verifying'" key="verifying" class="badge">
      <circle r="8.5" />
      <path :d="SHIELD" />
    </g>
    <g v-else-if="scene === 'ready'" key="ready" class="badge">
      <circle r="8.5" />
      <path class="draw" pathLength="1" d="M-3.5 0.2 L-1 2.8 L3.8 -2.4" />
    </g>
    <g v-else-if="scene === 'unreachable' || scene === 'failed'" key="alert" class="badge toned">
      <circle r="8.5" />
      <path d="M0 -4 V0.8 M0 3.4 V3.6" />
    </g>
    <g v-else-if="scene === 'refused'" key="refused" class="badge toned late">
      <circle r="8.5" />
      <path d="M-3 -3 L3 3 M3 -3 L-3 3" />
    </g>
    <g v-else-if="scene === 'hostKey'" key="hostKey" class="badge toned">
      <circle r="8.5" />
      <path :d="SHIELD" />
      <path class="crack" d="M0.6 -4.2 L-0.8 -1 L1 0.6 L-0.4 4.4" />
    </g>
  </Transition>
</template>

<style scoped>
.badge {
  transform-box: fill-box;
  transform-origin: center;
}
.badge circle {
  fill: var(--surface);
  stroke: var(--ink);
  stroke-width: 1.25;
}
.badge path {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.toned circle,
.toned path {
  stroke: var(--tone);
}
.crack {
  stroke-width: 1 !important;
}
.draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 0.35s var(--ease-out) 0.7s forwards;
}

.badge-enter-active {
  transition:
    scale 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.2s;
}
.badge-enter-active.late {
  transition-delay: 0.7s;
}
.badge-leave-active {
  transition:
    scale 0.15s var(--ease-out),
    opacity 0.15s;
}
.badge-enter-from,
.badge-leave-to {
  scale: 0.2;
  opacity: 0;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .draw {
    animation: none;
    stroke-dashoffset: 0;
  }
  .badge-enter-active,
  .badge-leave-active {
    transition-duration: 0.01ms;
    transition-delay: 0s;
  }
}
</style>
