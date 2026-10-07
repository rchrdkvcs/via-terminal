<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { Id } from '@/ipc/types'
import { terminals } from '@/terminal/registry'

const props = defineProps<{ tabId: Id }>()
const host = ref<HTMLElement>()

onMounted(() => host.value && terminals.attach(props.tabId, host.value))
onBeforeUnmount(() => terminals.detach(props.tabId))
watch(
  () => props.tabId,
  (next, previous) => {
    terminals.detach(previous)
    if (host.value) terminals.attach(next, host.value)
  },
)
useResizeObserver(host, () => terminals.refit(props.tabId))
</script>

<template>
  <div ref="host" class="h-full w-full [contain:strict]" />
</template>
