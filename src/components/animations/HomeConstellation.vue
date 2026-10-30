<script setup lang="ts">
import { computed } from 'vue'

/**
 * This machine at the center, the places it reaches around it.
 * Each orbit node stands for a recent host; with fewer than three, faint
 * placeholders keep the scene balanced and hint at hosts still to add.
 */
const props = withDefaults(defineProps<{ hosts?: number }>(), { hosts: 0 })

const CENTER = { x: 240, y: 110 }
const RADIUS = { x: 176, y: 74 }
const NODE = 24

const nodes = computed(() => {
  const count = Math.min(Math.max(props.hosts, 3), 5)
  return Array.from({ length: count }, (_, index) => {
    const angle = ((index / count) * 360 + (count % 2 ? -90 : -60)) * (Math.PI / 180)
    const x = CENTER.x + Math.cos(angle) * RADIUS.x
    const y = CENTER.y + Math.sin(angle) * RADIUS.y
    return {
      x,
      y,
      ghost: index >= props.hosts,
      dx: `${x - CENTER.x}px`,
      dy: `${y - CENTER.y}px`,
      delay: `${index * 1.15}s`,
      inbound: index % 2 === 1,
    }
  })
})

const STARS = [
  [34, 30, 0],
  [92, 176, 1.4],
  [140, 22, 2.6],
  [318, 196, 0.6],
  [402, 26, 2],
  [452, 150, 3.2],
  [20, 120, 3.8],
  [470, 82, 1],
] as const
</script>

<template>
  <svg class="constellation" viewBox="0 0 480 220" aria-hidden="true">
    <ellipse
      class="orbit"
      :cx="CENTER.x"
      :cy="CENTER.y"
      :rx="RADIUS.x"
      :ry="RADIUS.y"
      pathLength="100"
    />
    <ellipse
      class="orbit orbit-inner"
      :cx="CENTER.x"
      :cy="CENTER.y"
      :rx="RADIUS.x * 0.55"
      :ry="RADIUS.y * 0.55"
      pathLength="100"
    />

    <circle
      v-for="[x, y, delay] in STARS"
      :key="`${x}-${y}`"
      class="star"
      :cx="x"
      :cy="y"
      r="1.2"
      :style="{ animationDelay: `${delay}s` }"
    />

    <g v-for="(node, index) in nodes" :key="index" :class="{ ghost: node.ghost }">
      <line class="wire" :x1="CENTER.x" :y1="CENTER.y" :x2="node.x" :y2="node.y" />
      <circle
        v-if="!node.ghost"
        class="packet"
        :class="{ inbound: node.inbound }"
        :cx="CENTER.x"
        :cy="CENTER.y"
        r="2.25"
        :style="{ '--dx': node.dx, '--dy': node.dy, animationDelay: node.delay }"
      />
    </g>

    <g
      v-for="(node, index) in nodes"
      :key="`node-${index}`"
      class="host"
      :class="{ ghost: node.ghost }"
      :style="{ animationDelay: `${0.15 + index * 0.07}s` }"
    >
      <g :transform="`translate(${node.x - NODE / 2} ${node.y - NODE / 2})`">
        <rect :width="NODE" :height="NODE" rx="7" />
        <template v-if="!node.ghost">
          <path class="glyph" d="M7 9 H17 M7 12.5 H17 M7 16 H12" />
          <circle class="led" cx="16.5" cy="16" r="1.2" :style="{ animationDelay: node.delay }" />
        </template>
        <path v-else class="glyph plus" d="M12 8.5 V15.5 M8.5 12 H15.5" />
      </g>
    </g>

    <g class="core">
      <circle class="ripple" :cx="CENTER.x" :cy="CENTER.y" r="22" />
      <circle class="ripple ripple-late" :cx="CENTER.x" :cy="CENTER.y" r="22" />
      <rect :x="CENTER.x - 22" :y="CENTER.y - 22" width="44" height="44" rx="12" />
      <path
        class="glyph"
        :d="`M${CENTER.x - 9} ${CENTER.y - 6} L${CENTER.x - 3} ${CENTER.y} L${CENTER.x - 9} ${CENTER.y + 6}`"
      />
      <line
        class="glyph caret"
        :x1="CENTER.x + 1"
        :y1="CENTER.y + 7"
        :x2="CENTER.x + 10"
        :y2="CENTER.y + 7"
      />
    </g>
  </svg>
</template>

<style scoped>
.constellation {
  width: 100%;
  height: auto;
  overflow: visible;
}
.constellation * {
  transform-box: view-box;
}

.orbit {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1;
  stroke-dasharray: 0.6 1.6;
  opacity: 0.14;
  animation: drift 60s linear infinite;
}
.orbit-inner {
  opacity: 0.09;
  animation-duration: 40s;
  animation-direction: reverse;
}

.star {
  fill: var(--ink);
  opacity: 0.12;
  animation: twinkle 5s ease-in-out infinite;
}

.wire {
  stroke: var(--ink);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-dasharray: 2 5;
  opacity: 0.22;
  animation: flow 1.4s linear infinite;
}
.ghost .wire {
  opacity: 0.1;
  animation: none;
}

.packet {
  fill: var(--ink);
  opacity: 0;
  animation: travel 4.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
.packet.inbound {
  animation-name: travel-back;
}

.host {
  transform-box: fill-box;
  transform-origin: center;
  animation: arrive 0.5s var(--ease-out) both;
}
.host rect,
.core rect {
  fill: var(--surface);
  stroke: var(--edge-hover);
  stroke-width: 1.25;
}
.host.ghost rect {
  stroke-dasharray: 3 3;
  opacity: 0.7;
}
.host.ghost .glyph {
  opacity: 0.4;
}
.glyph {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.led {
  fill: var(--ink);
  animation: blink 4.6s ease-in-out infinite;
}

.core rect {
  stroke: var(--ink);
  stroke-opacity: 0.5;
}
.core .glyph {
  stroke-width: 1.75;
}
.caret {
  animation: caret 1.1s steps(2, jump-none) infinite;
}
.ripple {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.25;
  opacity: 0;
  transform-origin: 240px 110px;
  animation: ripple 4.6s var(--ease-out) infinite;
}
.ripple-late {
  animation-delay: 2.3s;
}

@keyframes drift {
  to {
    stroke-dashoffset: -100;
  }
}
@keyframes twinkle {
  50% {
    opacity: 0.4;
  }
}
@keyframes flow {
  to {
    stroke-dashoffset: -7;
  }
}
/* One crossing, then a quiet hold so the scene never feels busy. */
@keyframes travel {
  0% {
    transform: translate(0, 0);
    opacity: 0;
  }
  6%,
  30% {
    opacity: 0.9;
  }
  36%,
  100% {
    transform: translate(var(--dx), var(--dy));
    opacity: 0;
  }
}
@keyframes travel-back {
  0% {
    transform: translate(var(--dx), var(--dy));
    opacity: 0;
  }
  6%,
  30% {
    opacity: 0.9;
  }
  36%,
  100% {
    transform: translate(0, 0);
    opacity: 0;
  }
}
@keyframes arrive {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}
@keyframes blink {
  0%,
  30%,
  100% {
    opacity: 0.25;
  }
  36% {
    opacity: 1;
  }
}
@keyframes caret {
  50% {
    opacity: 0;
  }
}
@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 0;
  }
  4% {
    opacity: 0.45;
  }
  40%,
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .constellation * {
    animation: none !important;
  }
}
</style>
