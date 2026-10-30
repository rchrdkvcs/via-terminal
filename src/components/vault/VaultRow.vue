<script setup lang="ts">
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { Id } from '@/ipc/types'

defineProps<{ id: Id; current: boolean; tabbable: boolean }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child :disabled="!$slots.menu">
      <div
        role="option"
        :data-row-id="id"
        :aria-selected="current"
        :tabindex="tabbable ? 0 : -1"
        class="group/row relative flex min-h-11 cursor-default items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px] outline-none select-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:bg-row-hover"
        @click="emit('open')"
      >
        <slot />
        <div
          v-if="$slots.actions"
          class="ms-auto hidden shrink-0 items-center gap-1 group-hover/row:flex group-focus-visible/row:flex group-data-[state=open]/row:flex"
        >
          <slot name="actions" />
        </div>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent v-if="$slots.menu" class="min-w-52">
      <slot name="menu" />
    </ContextMenuContent>
  </ContextMenu>
</template>
