<script setup lang="ts">
defineProps<{ title: string; description: string }>()
</script>

<template>
  <div class="grid max-w-80 justify-items-center gap-1.5 text-center">
    <p class="text-[13px] font-medium">{{ title }}</p>
    <p class="text-muted-foreground text-xs leading-relaxed text-pretty">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2.5 flex gap-2">
      <slot />
    </div>
  </div>
</template>
