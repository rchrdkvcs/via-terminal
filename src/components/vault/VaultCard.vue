<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <section
    :aria-label="title"
    class="grid gap-4 border-t border-hairline pt-7 first-of-type:border-0 first-of-type:pt-0"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-[15px] font-semibold tracking-[-0.01em]">{{ title }}</h3>
        <p v-if="description" class="mt-0.5 text-xs leading-snug text-pretty text-ink-muted">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-0.5">
        <slot name="actions" />
      </div>
    </div>
    <div class="grid gap-4">
      <slot />
    </div>
  </section>
</template>
