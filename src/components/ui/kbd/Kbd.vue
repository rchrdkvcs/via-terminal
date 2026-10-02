<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <kbd
    :class="
      cn(
        'material-control pointer-events-none inline-flex h-[18px] w-fit min-w-[18px] items-center justify-center gap-0.5 rounded-[5px] px-1 font-sans text-[11px] font-medium text-ink-muted select-none',
        `[&_svg:not([class*='size-'])]:size-3`,
        '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
        props.class,
      )
    "
  >
    <slot />
  </kbd>
</template>
