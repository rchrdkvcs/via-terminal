<script setup lang="ts">
defineProps<{ label: string; description?: string; forId?: string; stacked?: boolean }>()
</script>

<template>
  <!--
    One row per setting: name and explanation on the leading edge, control on
    the trailing edge. No divider — space alone carries the grouping.
  -->
  <div
    class="flex gap-6 py-3.5"
    :class="stacked ? 'flex-col gap-2' : 'items-center justify-between'"
  >
    <div class="min-w-0 space-y-0.5">
      <label :for="forId" class="block text-sm font-medium leading-none">{{ label }}</label>
      <p v-if="description" class="text-xs leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div class="shrink-0" :class="stacked ? 'w-full' : ''">
      <slot />
    </div>
  </div>
</template>
