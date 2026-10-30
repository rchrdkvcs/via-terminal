<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <section :aria-label="title" class="grid gap-2.5">
    <h3 v-if="title" class="px-1 text-[13px] font-semibold tracking-[-0.005em]">{{ title }}</h3>
    <div class="material-panel divide-y divide-hairline rounded-xl px-4">
      <slot />
    </div>
    <slot name="after" />
  </section>
</template>
