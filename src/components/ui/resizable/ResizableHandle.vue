<script setup lang="ts">
import type { SplitterResizeHandleEmits, SplitterResizeHandleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { GripVertical } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { SplitterResizeHandle, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<
  SplitterResizeHandleProps & { class?: HTMLAttributes['class']; withHandle?: boolean }
>()
const emits = defineEmits<SplitterResizeHandleEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'withHandle')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SplitterResizeHandle
    data-slot="resizable-handle"
    v-bind="forwarded"
    :class="
      cn(
        'group/resize focus-visible:ring-ring relative flex w-px items-center justify-center bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-2 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0 [&[data-orientation=vertical]>div]:rotate-90',
        props.class,
      )
    "
  >
    <span class="resize-hover-line" aria-hidden="true" />
    <template v-if="props.withHandle">
      <div class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
        <slot>
          <GripVertical class="size-2.5" />
        </slot>
      </div>
    </template>
  </SplitterResizeHandle>
</template>

<style scoped>
.resize-hover-line {
  width: 1px;
  height: 70%;
  border-radius: 999px;
  background: linear-gradient(to bottom, transparent, var(--color-border), transparent);
  opacity: 0;
  transition: opacity 100ms ease-out;
}

[data-slot='resizable-handle']:hover .resize-hover-line,
[data-slot='resizable-handle']:focus-visible .resize-hover-line,
[data-slot='resizable-handle'][data-state='dragging'] .resize-hover-line {
  opacity: 1;
}

[data-orientation='vertical'] .resize-hover-line {
  width: 70%;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--color-border), transparent);
}
</style>
