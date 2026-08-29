<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <section class="space-y-1">
    <header class="pb-2">
      <h2 class="text-lg font-semibold tracking-tight">{{ title }}</h2>
      <p v-if="description" class="pt-1 text-sm text-muted-foreground">{{ description }}</p>
    </header>
    <div class="divide-y divide-border/60">
      <slot />
    </div>
  </section>
</template>
