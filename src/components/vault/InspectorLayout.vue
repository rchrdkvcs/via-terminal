<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; error?: string | null }>()
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex min-h-14 shrink-0 items-start gap-2 px-5 pt-4 pb-3">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-[15px] font-semibold tracking-[-0.01em]">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 truncate text-xs text-ink-muted">{{ subtitle }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <slot name="actions" />
      </div>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
      <div class="grid gap-4">
        <slot />
      </div>
      <p v-if="error" role="alert" class="text-destructive mt-3 text-xs leading-snug text-pretty">
        {{ error }}
      </p>
    </div>
    <footer
      v-if="$slots.footer"
      class="flex shrink-0 justify-end gap-2 border-t border-hairline px-5 py-3"
    >
      <slot name="footer" />
    </footer>
  </div>
</template>
