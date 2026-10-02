<script setup lang="ts">
import type { CommandItem } from './types'

defineProps<{ item: CommandItem; active: boolean }>()
</script>

<template>
  <div
    :id="`command-${item.id}`"
    role="option"
    :aria-selected="active"
    :data-active="active || undefined"
    class="flex h-10 cursor-default items-center gap-3 rounded-[9px] px-2.5 text-[13px]"
    :class="active ? 'bg-menu-hover' : ''"
  >
    <component :is="item.icon" :size="16" :stroke-width="1.5" class="shrink-0 text-ink-muted" />
    <span class="shrink-0 truncate">{{ item.label }}</span>
    <span v-if="item.detail" class="min-w-0 flex-1 truncate text-xs text-ink-faint">{{
      item.detail
    }}</span>
    <span v-else class="flex-1" />
    <span v-if="item.shortcut" class="shrink-0 text-[11.5px] text-ink-faint">{{
      item.shortcut
    }}</span>
  </div>
</template>
