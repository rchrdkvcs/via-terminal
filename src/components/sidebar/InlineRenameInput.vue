<script setup lang="ts">
import { Input } from '@/components/ui/input'

defineProps<{ label: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <Input
    v-model="model"
    class="h-7 min-w-0 border-sidebar-border bg-sidebar px-2 py-0 text-sm shadow-xs focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30 focus-visible:ring-2"
    :aria-label="label"
  />
</template>
