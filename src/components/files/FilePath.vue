<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronRight, Pencil } from '@lucide/vue'
import { Button } from '@/components/ui/button'
const props = defineProps<{ directory: string; connected: boolean }>()
const emit = defineEmits<{ navigate: [path: string] }>()
const editing = ref(false),
  path = ref(''),
  input = ref<HTMLInputElement>()
const display = ref<InstanceType<typeof Button>>()
const parts = computed(() => {
  const clean = props.directory.replace(/\/$/, '')
  const index = clean.lastIndexOf('/')
  return { parent: clean.slice(0, index) || '/', name: clean.slice(index + 1) || '/' }
})
watch(
  () => props.directory,
  (directory) => {
    path.value = directory
    editing.value = false
  },
  { immediate: true },
)
watch(
  () => props.connected,
  (connected) => {
    if (!connected) editing.value = false
  },
)
async function edit() {
  path.value = props.directory
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}
async function finish(submit = false) {
  const directory = path.value
  editing.value = false
  if (submit && directory) emit('navigate', directory)
  await nextTick()
  display.value?.$el.focus()
}
</script>
<template>
  <form v-if="editing" class="flex h-7 min-w-0 flex-1 items-center" @submit.prevent="finish(true)">
    <input
      ref="input"
      v-model="path"
      aria-label="Chemin distant"
      spellcheck="false"
      class="h-7 min-w-0 flex-1 rounded-md bg-transparent px-2 font-mono text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      :disabled="!connected"
      @keydown.esc.prevent.stop="finish()"
      @blur="editing = false"
    />
  </form>
  <Button
    v-else
    ref="display"
    type="button"
    variant="ghost"
    size="sm"
    class="min-w-0 flex-1 justify-start font-mono text-xs font-normal"
    aria-label="Modifier le chemin distant"
    :title="directory"
    :disabled="!connected"
    @click="edit"
  >
    <span
      v-if="directory !== '/' && directory.includes('/')"
      class="hidden min-w-0 truncate text-ink-muted @[18rem]:block"
      >{{ parts.parent }}</span
    >
    <ChevronRight
      v-if="directory !== '/' && directory.includes('/')"
      class="hidden @[18rem]:block"
      :stroke-width="1.5"
    />
    <span class="min-w-0 truncate text-foreground">{{ parts.name }}</span>
    <Pencil class="ms-auto" :stroke-width="1.5" />
  </Button>
</template>
