<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** A small icon button whose name is both announced and shown on hover. */
defineOptions({ inheritAttrs: false })
defineProps<{ label: string }>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        :aria-label="label"
        v-bind="$attrs"
      >
        <slot />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>
