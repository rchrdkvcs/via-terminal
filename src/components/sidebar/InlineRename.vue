<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

/** Enter commits, Escape cancels, blur commits. */
const props = defineProps<{ value: string; label: string }>()
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

onMounted(async () => {
  await nextTick()
  input.value?.focus()
  input.value?.select()
})
</script>

<template>
  <input
    ref="input"
    v-model="draft"
    :aria-label="label"
    class="h-6 min-w-0 flex-1 rounded-sm bg-surface px-1 text-[13px] text-foreground outline-2 outline-ring"
    @keydown.enter.prevent="finish(true)"
    @keydown.escape.prevent="finish(false)"
    @keydown.stop
    @blur="finish(true)"
    @click.stop
  />
</template>
