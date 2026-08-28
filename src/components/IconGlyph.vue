<script setup lang="ts">
import * as icons from 'lucide-vue-next'
import { computed } from 'vue'
const props = withDefaults(defineProps<{ name?: string; size?: number }>(), {
  name: 'Circle',
  size: 17,
})
const icon = computed(
  () => (icons as unknown as Record<string, typeof icons.Circle>)[props.name] ?? icons.Circle,
)
</script>
<template><component :is="icon" :size="size" :stroke-width="1.8" aria-hidden="true" /></template>
