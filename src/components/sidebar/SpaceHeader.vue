<script setup lang="ts">
import type { Space } from '@/domain/space'
import { spaceIcon } from './spaceIcons'

defineProps<{ space: Space }>()
</script>

<template>
  <div class="flex h-8 items-center gap-2 px-2 text-[13px] font-semibold">
    <component :is="spaceIcon(space.icon)" :size="15" :stroke-width="1.5" class="text-ink-muted" />
    <span class="min-w-0 flex-1 truncate">
      {{ space.name }}
    </span>
  </div>
</template>
