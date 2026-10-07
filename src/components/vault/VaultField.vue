<script setup lang="ts">
defineProps<{ label: string; for?: string; hint?: string }>()
</script>

<template>
  <div class="grid gap-1.5">
    <component
      :is="$props.for ? 'label' : 'span'"
      :for="$props.for"
      class="text-muted-foreground text-xs"
    >
      {{ label }}
    </component>
    <slot />
    <p v-if="hint" class="text-muted-foreground text-xs leading-snug text-pretty">{{ hint }}</p>
  </div>
</template>
