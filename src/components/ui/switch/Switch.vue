<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<SwitchRootProps & { class?: HTMLAttributes['class'] }>()

const emits = defineEmits<SwitchRootEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SwitchRoot
    v-slot="slotProps"
    data-slot="switch"
    v-bind="forwarded"
    :class="
      cn(
        'peer inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-[2px] outline-none transition-[background-color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50 data-[state=unchecked]:bg-sunken data-[state=unchecked]:shadow-[var(--shadow-sunken)] data-[state=checked]:bg-primary data-[state=checked]:shadow-[var(--shadow-accent)]',
        props.class,
      )
    "
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :class="
        cn(
          'pointer-events-none block size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3),0_0_0_0.5px_rgb(0_0_0/0.12)] transition-transform duration-150 ease-[var(--ease-out)] data-[state=checked]:translate-x-[12px] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-[#141415]',
        )
      "
    >
      <slot name="thumb" v-bind="slotProps" />
    </SwitchThumb>
  </SwitchRoot>
</template>
