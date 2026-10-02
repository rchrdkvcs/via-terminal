<script setup lang="ts">
/** The inspector frame: a titled header with actions, a scrolling form, an optional footer. */
defineProps<{ title: string; subtitle?: string; error?: string | null }>()
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex min-h-12 shrink-0 items-start gap-2 px-4 pt-3 pb-2">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-[13px] font-medium">{{ title }}</h2>
        <p v-if="subtitle" class="text-muted-foreground truncate text-xs">{{ subtitle }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <slot name="actions" />
      </div>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <div class="grid gap-3.5">
        <slot />
      </div>
      <p v-if="error" role="alert" class="text-destructive mt-3 text-xs leading-snug text-pretty">
        {{ error }}
      </p>
    </div>
    <footer
      v-if="$slots.footer"
      class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3"
    >
      <slot name="footer" />
    </footer>
  </div>
</template>
