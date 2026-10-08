<script setup lang="ts">
import type { SceneTone, SessionScene } from '@/domain/session-scene'
import LinkBadge from './LinkBadge.vue'

/**
 * This machine and the server as two nodes, the session as the line between them.
 * A local shell has no server, so it shows the local node alone.
 */
withDefaults(defineProps<{ scene: SessionScene; tone?: SceneTone; local?: boolean }>(), {
  tone: 'neutral',
  local: false,
})

const SPARKS = [0, 50, 110, 180, 230, 300].map((degrees) => {
  const angle = (degrees * Math.PI) / 180
  return `M120 48 L${120 + Math.cos(angle) * 12} ${48 + Math.sin(angle) * 12}`
})
</script>

<template>
  <svg
    class="session-link"
    :class="{ local }"
    :viewBox="local ? '0 0 80 96' : '0 0 240 96'"
    :data-scene="scene"
    :data-tone="tone"
    aria-hidden="true"
  >
    <template v-if="!local">
      <g class="half half-start"><line class="wire" x1="58" y1="48" x2="120" y2="48" /></g>
      <g class="half half-end"><line class="wire" x1="120" y1="48" x2="182" y2="48" /></g>
      <line class="live" x1="58" y1="48" x2="182" y2="48" pathLength="100" />

      <circle
        v-for="index in 3"
        :key="index"
        class="packet"
        cx="58"
        cy="48"
        r="2.5"
        :style="{ animationDelay: `${(index - 1) * 0.28}s` }"
      />

      <g class="key">
        <g transform="translate(60 38)">
          <circle r="3.2" />
          <path d="M3.2 0 H12 M9 0 V3 M11.5 0 V2.4" />
        </g>
      </g>

      <g class="spark">
        <path v-for="spark in SPARKS" :key="spark" :d="spark" />
      </g>
    </template>

    <g class="node node-local">
      <circle class="ripple" cx="40" cy="48" r="16" />
      <rect x="26" y="34" width="28" height="28" rx="8" />
      <path class="glyph" d="M34 43 L38 47 L34 51 M40 52 H46" />
    </g>

    <g v-if="!local" class="node node-server">
      <circle class="halo" cx="200" cy="48" r="22" />
      <circle class="ripple" cx="200" cy="48" r="16" />
      <rect x="186" y="34" width="28" height="28" rx="8" />
      <path class="glyph" d="M193 43 H207 M193 48.5 H207 M193 54 H201" />
      <circle class="led" cx="206" cy="54" r="1.4" />
    </g>

    <g :transform="local ? 'translate(56 32)' : 'translate(216 32)'">
      <LinkBadge :scene="scene" />
    </g>
  </svg>
</template>

<style scoped>
.session-link {
  width: 100%;
  max-width: 300px;
  overflow: visible;
  --tone: var(--ink);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
.session-link.local {
  max-width: 100px;
}
.session-link[data-tone='warning'] {
  --tone: var(--state-pending);
}
.session-link[data-tone='danger'] {
  --tone: var(--state-error);
}
.session-link * {
  transform-box: view-box;
}

/* ---------- wire ---------- */
.wire {
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 2 5;
  opacity: 0.25;
  transition:
    stroke 0.3s,
    opacity 0.3s;
}
.half {
  transition: transform 0.55s var(--spring);
}
.half-start {
  transform-origin: 58px 48px;
}
.half-end {
  transform-origin: 182px 48px;
}
.live {
  stroke: var(--ink);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transition: stroke-dashoffset 0.7s var(--ease-out);
}
[data-scene='connecting'] .wire,
[data-scene='verifying'] .wire,
[data-scene='authenticating'] .wire {
  opacity: 0.5;
  animation: flow 0.7s linear infinite;
}
[data-scene='ready'] .live {
  stroke-dashoffset: 0;
}
[data-scene='unreachable'] .half-end .wire {
  opacity: 0.15;
  stroke-dasharray: 1 7;
}
[data-scene='refused'] .half-end .wire,
[data-scene='hostKey'] .half-end .wire,
[data-scene='failed'] .half-end .wire {
  stroke: var(--tone);
  opacity: 0.6;
}
[data-scene='disconnected'] .wire {
  stroke: var(--tone);
  stroke-dasharray: none;
  opacity: 0.85;
}
[data-scene='disconnected'] .half-start {
  transform: rotate(16deg) translate(-2px, 2px);
}
[data-scene='disconnected'] .half-end {
  transform: rotate(-16deg) translate(2px, 2px);
}
[data-scene='asleep'] .wire,
[data-scene='exited'] .wire {
  opacity: 0.15;
}

/* ---------- packets and key ---------- */
.packet {
  fill: var(--ink);
  opacity: 0;
}
[data-scene='connecting'] .packet {
  animation: travel 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
[data-scene='verifying'] .packet {
  animation: travel 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
[data-scene='unreachable'] .packet {
  fill: var(--tone);
  animation: fade-midway 1.3s var(--ease-out) forwards;
}
.key {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0;
  transform-origin: 66px 38px;
}
[data-scene='authenticating'] .key {
  animation: carry-key 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
[data-scene='refused'] .key {
  animation: bounce-key 1.3s var(--ease-out) forwards;
}
.spark path {
  stroke: var(--tone);
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0;
  transform-origin: 120px 48px;
}
[data-scene='disconnected'] .spark path {
  animation: spark 0.6s var(--ease-out) 0.08s forwards;
}

/* ---------- nodes ---------- */
.node {
  transition: opacity 0.4s;
}
.node rect {
  fill: var(--surface);
  stroke: var(--edge-hover);
  stroke-width: 1.25;
  transition: stroke 0.3s;
}
.glyph {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.led {
  fill: var(--ink-faint);
  transition: fill 0.3s;
}
.node-local,
.node-local .ripple {
  transform-origin: 40px 48px;
}
.node-server,
.node-server .ripple,
.halo {
  transform-origin: 200px 48px;
}
.halo {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.25;
  stroke-dasharray: 3 6;
  opacity: 0;
  transition:
    opacity 0.3s,
    stroke 0.3s;
}
.ripple {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  opacity: 0;
}
[data-scene='verifying'] .halo {
  opacity: 0.8;
  animation: spin 2.4s linear infinite;
}
[data-scene='verifying'] .led,
[data-scene='authenticating'] .led {
  fill: var(--ink);
  animation: blink 0.5s steps(2) infinite;
}
[data-scene='ready'] .node rect {
  stroke: var(--ink);
}
[data-scene='ready'] .led {
  fill: var(--ink);
}
[data-scene='ready'] .node-local .ripple {
  animation: ripple 0.9s var(--ease-out) 0.1s;
}
[data-scene='ready'] .node-server .ripple {
  animation: ripple 0.9s var(--ease-out) 0.5s;
}
[data-scene='unreachable'] .node-server {
  opacity: 0.35;
}
[data-scene='unreachable'] .node-server rect {
  stroke-dasharray: 3 3;
}
[data-scene='refused'] .node-server rect,
[data-scene='hostKey'] .node-server rect,
[data-scene='failed'] .node-server rect {
  stroke: var(--tone);
}
[data-scene='refused'] .node-server rect {
  animation: flash 0.5s var(--ease-out) 0.55s;
}
[data-scene='refused'] .led,
[data-scene='hostKey'] .led,
[data-scene='failed'] .led,
[data-scene='disconnected'] .led {
  fill: var(--tone);
}
[data-scene='hostKey'] .halo {
  opacity: 0.8;
  stroke: var(--tone);
}
[data-scene='hostKey'] .node-server,
[data-scene='failed'] .node-server {
  animation: jitter 0.36s steps(3) 3;
}
.local[data-scene='failed'] .node-local {
  animation: jitter 0.36s steps(3) 3;
}
.local[data-scene='failed'] .node-local rect {
  stroke: var(--tone);
}
[data-scene='disconnected'] .node-server {
  opacity: 0.5;
}
[data-scene='exited'] .node,
[data-scene='asleep'] .node-server {
  opacity: 0.4;
}
[data-scene='asleep'] .node-local {
  animation: breathe 3.2s ease-in-out infinite;
}

/* ---------- keyframes ---------- */
@keyframes flow {
  to {
    stroke-dashoffset: -7;
  }
}
@keyframes travel {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  15%,
  85% {
    opacity: 1;
  }
  100% {
    transform: translateX(124px);
    opacity: 0;
  }
}
@keyframes fade-midway {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  70% {
    transform: translateX(74px);
    opacity: 1;
  }
  100% {
    transform: translateX(80px) scale(0);
    opacity: 0;
  }
}
@keyframes carry-key {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  70% {
    transform: translateX(108px);
    opacity: 1;
  }
  100% {
    transform: translateX(112px);
    opacity: 0;
  }
}
@keyframes bounce-key {
  0% {
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  42% {
    transform: translateX(108px);
    stroke: var(--ink);
  }
  48% {
    transform: translateX(96px);
    stroke: var(--tone);
  }
  54% {
    transform: translateX(104px);
  }
  60% {
    transform: translateX(99px);
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateX(60px) translateY(10px) rotate(30deg);
    stroke: var(--tone);
    opacity: 0;
  }
}
@keyframes spark {
  0% {
    transform: scale(0.2);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes blink {
  50% {
    opacity: 0.25;
  }
}
@keyframes ripple {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
@keyframes flash {
  30% {
    fill: color-mix(in srgb, var(--tone) 30%, var(--surface));
  }
}
@keyframes jitter {
  33% {
    transform: translate(-3px, 1px);
  }
  66% {
    transform: translate(2px, -1px);
  }
}
@keyframes breathe {
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-link * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
