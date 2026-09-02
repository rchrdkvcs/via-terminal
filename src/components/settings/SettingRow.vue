<script setup lang="ts">
defineProps<{ label: string; description?: string; forId?: string; stacked?: boolean }>()
</script>

<template>
  <!--
    One row per setting: name and explanation on the leading edge, control on
    the trailing edge. No divider — space alone carries the grouping.
  -->
  <div
    class="flex gap-3 py-4 sm:gap-6"
    :class="stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between'"
  >
    <div class="min-w-0 space-y-0.5">
      <label :for="forId" class="block text-sm font-medium leading-none">{{ label }}</label>
      <p v-if="description" class="text-xs leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div class="shrink-0" :class="stacked ? 'w-full' : 'w-full sm:w-auto'">
      <slot />
    </div>
  </div>
</template>
