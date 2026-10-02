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
    class="flex h-10 cursor-default items-center gap-3 rounded-lg px-2.5 text-[13px]"
    :class="active ? 'bg-row-selected shadow-row' : ''"
  >
    <component
      :is="item.icon"
      :size="16"
      :stroke-width="1.5"
      class="shrink-0 text-muted-foreground"
    />
    <span class="shrink-0 truncate">{{ item.label }}</span>
    <span v-if="item.detail" class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{
      item.detail
    }}</span>
    <span v-else class="flex-1" />
    <span v-if="item.shortcut" class="shrink-0 text-xs text-muted-foreground">{{
      item.shortcut
    }}</span>
    <span v-else-if="active" class="shrink-0 text-xs text-muted-foreground">Entrée</span>
  </div>
</template>
