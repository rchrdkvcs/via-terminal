<script setup lang="ts">
import { X } from '@lucide/vue'
import { ref } from 'vue'
import { addTags } from './format'

/** Tags as chips: Enter or a comma adds, Backspace on empty removes the last. */
defineProps<{ id: string }>()
const model = defineModel<string[]>({ required: true })
const emit = defineEmits<{ commit: [] }>()
const text = ref('')

function add() {
  const next = addTags(model.value, text.value)
  text.value = ''
  if (next.length === model.value.length) return
  model.value = next
  emit('commit')
}

function remove(tag: string) {
  model.value = model.value.filter((candidate) => candidate !== tag)
  emit('commit')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    add()
  } else if (event.key === 'Backspace' && !text.value && model.value.length) {
    remove(model.value[model.value.length - 1])
  }
}
</script>

<template>
  <div
    class="border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex min-h-8 flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 shadow-xs focus-within:ring-3"
  >
    <span
      v-for="tag in model"
      :key="tag"
      class="bg-muted text-foreground inline-flex h-5 items-center gap-0.5 rounded-sm ps-1.5 text-xs"
    >
      {{ tag }}
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-4 place-items-center rounded-sm outline-none focus-visible:ring-2"
        :aria-label="`Retirer le tag ${tag}`"
        @click="remove(tag)"
      >
        <X class="size-3" :stroke-width="1.5" />
      </button>
    </span>
    <input
      :id="id"
      v-model="text"
      class="placeholder:text-muted-foreground h-5 min-w-20 flex-1 bg-transparent px-1 text-[13px] outline-none"
      :placeholder="model.length ? '' : 'prod, web'"
      @keydown="onKeydown"
      @blur="add"
    />
  </div>
</template>
