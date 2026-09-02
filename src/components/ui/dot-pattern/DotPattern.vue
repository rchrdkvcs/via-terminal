<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    width?: number
    height?: number
    cx?: number
    cy?: number
    cr?: number
  }>(),
  {
    width: 20,
    height: 20,
    cx: 1,
    cy: 1,
    cr: 1,
  },
)

const patternId = `dot-pattern-${useId().replace(/:/g, '')}`
</script>

<template>
  <svg aria-hidden="true" class="pointer-events-none" width="100%" height="100%">
    <defs>
      <pattern :id="patternId" :width="width" :height="height" patternUnits="userSpaceOnUse">
        <circle :cx="cx" :cy="cy" :r="cr" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" :fill="`url(#${patternId})`" />
  </svg>
</template>
