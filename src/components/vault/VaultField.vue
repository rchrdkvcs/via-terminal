<script setup lang="ts">
defineProps<{ label: string; for?: string; hint?: string }>()
</script>

<template>
  <div class="grid gap-1">
    <component
      :is="$props.for ? 'label' : 'span'"
      :for="$props.for"
      class="text-[13px] font-medium text-foreground"
    >
      {{ label }}
    </component>
    <slot />
    <p v-if="hint" class="text-xs leading-snug text-pretty text-ink-muted">{{ hint }}</p>
  </div>
</template>
