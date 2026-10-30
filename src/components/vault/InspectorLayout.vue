<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; error?: string | null }>()
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto grid w-full max-w-[720px] gap-7 px-10 pt-8 pb-10">
        <header class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-[20px] font-semibold tracking-[-0.02em]">{{ title }}</h2>
            <p v-if="subtitle" class="mt-1 text-xs text-pretty text-ink-muted">{{ subtitle }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <slot name="actions" />
          </div>
        </header>
        <slot />
        <p v-if="error" role="alert" class="text-xs leading-snug text-pretty text-destructive">
          {{ error }}
        </p>
      </div>
    </div>
    <footer
      v-if="$slots.footer"
      class="flex shrink-0 justify-end gap-2 border-t border-hairline px-6 py-3"
    >
      <slot name="footer" />
    </footer>
  </div>
</template>
