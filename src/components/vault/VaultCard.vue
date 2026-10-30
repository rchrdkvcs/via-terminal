<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <section :aria-label="title" class="grid gap-2.5">
    <div class="px-1">
      <h3 class="text-[13px] font-semibold tracking-[-0.005em]">{{ title }}</h3>
      <p v-if="description" class="mt-0.5 text-xs leading-snug text-pretty text-ink-muted">
        {{ description }}
      </p>
    </div>
    <div class="material-panel grid gap-4 rounded-xl p-4">
      <slot />
    </div>
  </section>
</template>
