<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ContextMenuContent, ContextMenuPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<ContextMenuContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<ContextMenuContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

/** An item that moved focus (a rename field, an editor) keeps it when the menu closes. */
function keepMovedFocus(event: Event) {
  const active = document.activeElement
  if (active && active !== document.body && !active.closest('[role="menu"]')) {
    event.preventDefault()
  }
}
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      data-slot="context-menu-content"
      v-bind="{ ...$attrs, ...forwarded }"
      @close-auto-focus="keepMovedFocus"
      :class="
        cn(
          'material-raised text-popover-foreground z-50 min-w-[10rem] overflow-x-hidden overflow-y-auto rounded-[10px] p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-100 motion-reduce:animate-none max-h-(--reka-context-menu-content-available-height) origin-(--reka-context-menu-content-transform-origin)',
          props.class,
        )
      "
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
