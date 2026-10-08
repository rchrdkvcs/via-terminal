<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ value: string; label: string; maxlength?: number }>()
const emit = defineEmits<{ commit: [value: string]; cancel: [] }>()
const draft = ref(props.value)
const input = ref<HTMLInputElement>()
let done = false

function finish(commit: boolean) {
  if (done) return
  done = true
  if (commit) emit('commit', draft.value)
  else emit('cancel')
}

let focusFrame: number | undefined
onMounted(() => {
  // Let the menu/dialog finish closing before moving focus outside its focus scope.
  focusFrame = requestAnimationFrame(() => {
    input.value?.focus()
    input.value?.select()
  })
})
onUnmounted(() => {
  if (focusFrame !== undefined) cancelAnimationFrame(focusFrame)
})
</script>

<template>
  <input
    ref="input"
    v-model="draft"
    :aria-label="label"
    :maxlength="maxlength"
    class="material-field h-6 min-w-0 flex-1 rounded-[5px] px-1.5 text-[13px] text-foreground outline-none"
    @keydown.enter.prevent="finish(true)"
    @keydown.escape.prevent="finish(false)"
    @keydown.stop
    @blur="finish(true)"
    @click.stop
  />
</template>
