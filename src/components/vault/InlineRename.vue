<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'

/** Edits a name in place: Enter or blur keeps it, Escape restores the old one. */
const props = defineProps<{ value: string; label: string }>()
const emit = defineEmits<{ done: [name: string | null] }>()
const text = ref(props.value)
const input = useTemplateRef('input')
let finished = false

// A frame later, so a closing menu cannot take the focus back.
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

// Typing here must not reach the list's or tree's shortcuts.
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
    class="bg-surface focus-visible:ring-ring h-6 min-w-0 flex-1 rounded-sm px-1.5 text-[13px] outline-none focus-visible:ring-2"
    @click.stop
    @dblclick.stop
    @keydown="onKeydown"
    @blur="finish(true)"
  />
</template>
