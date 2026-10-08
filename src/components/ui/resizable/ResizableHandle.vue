<script setup lang="ts">
import type { SplitterResizeHandleEmits, SplitterResizeHandleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { SplitterResizeHandle, useForwardPropsEmits } from 'reka-ui'
import ResizeHandle from '@/components/ui/resize-handle/ResizeHandle.vue'

const props = defineProps<
  Omit<SplitterResizeHandleProps, 'as' | 'asChild'> & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<SplitterResizeHandleEmits>()
const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ResizeHandle :as="SplitterResizeHandle" v-bind="forwarded" :class="props.class" />
</template>
