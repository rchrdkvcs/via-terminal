<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'

const props = defineProps<{ value: string; label: string }>()
const emit = defineEmits<{ done: [name: string | null] }>()
const text = ref(props.value)
const input = useTemplateRef('input')
let finished = false

onMounted(() =>
  requestAnimationFrame(() => {
    input.value?.focus()
    input.value?.select()
  }),
)

function finish(keep: boolean) {
  if (finished) return
  finished = true
  const name = text.value.trim()
  emit('done', keep && name && name !== props.value ? name : null)
}

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key !== 'Enter' && event.key !== 'Escape') return
  event.preventDefault()
  finish(event.key === 'Enter')
}
</script>

<template>
  <input
    ref="input"
    v-model="text"
    :aria-label="label"
    class="material-field h-6 min-w-0 flex-1 rounded-[5px] px-1.5 text-[13px] outline-none"
    @click.stop
    @dblclick.stop
    @keydown="onKeydown"
    @blur="finish(true)"
  />
</template>
