<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronRight, Pencil } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { collapse, crumbs } from './breadcrumb'
/**
 * The current directory as a breadcrumb: each folder is a link up the tree. The pencil, a
 * double click on the bar, or the hidden middle (…) turns it into an editable path, completed
 * from the subdirectories shown in the list.
 */
const props = defineProps<{ directory: string; connected: boolean; directories?: string[] }>()
const emit = defineEmits<{ navigate: [path: string] }>()
const editing = ref(false),
  path = ref(''),
  input = ref<HTMLInputElement>()
const pencil = ref<InstanceType<typeof Button>>()
const listId = `file-path-${Math.random().toString(36).slice(2)}`
const shown = computed(() => collapse(crumbs(props.directory)))
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
  if (!props.connected) return
  path.value = props.directory
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}
async function finish(submit = false) {
  const directory = path.value.trim() === '' ? '' : path.value
  editing.value = false
  if (submit && directory) emit('navigate', directory)
  await nextTick()
  pencil.value?.$el.focus()
}
</script>
<template>
  <form v-if="editing" class="flex h-7 min-w-0 flex-1 items-center" @submit.prevent="finish(true)">
    <input
      ref="input"
      v-model="path"
      aria-label="Chemin distant"
      spellcheck="false"
      autocomplete="off"
      :list="listId"
      class="h-7 min-w-0 flex-1 rounded-md bg-transparent px-2 font-mono text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      :disabled="!connected"
      @keydown.esc.prevent.stop="finish()"
      @blur="editing = false"
    />
    <datalist :id="listId">
      <option v-for="option in directories ?? []" :key="option" :value="option" />
    </datalist>
  </form>
  <div v-else class="flex h-7 min-w-0 flex-1 items-center" :title="directory" @dblclick.self="edit">
    <nav aria-label="Chemin distant" class="flex min-w-0 items-center overflow-hidden">
      <template v-for="(crumb, index) in shown" :key="crumb?.path ?? 'more'">
        <ChevronRight
          v-if="index > 0"
          :size="12"
          :stroke-width="1.5"
          class="shrink-0 text-ink-faint"
          aria-hidden="true"
        />
        <button
          v-if="crumb === null"
          type="button"
          class="h-6 shrink-0 rounded-[5px] px-1.5 font-mono text-xs text-ink-muted outline-none hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Afficher le chemin complet"
          :disabled="!connected"
          @click="edit"
        >
          …
        </button>
        <button
          v-else
          type="button"
          class="h-6 min-w-0 truncate rounded-[5px] px-1.5 font-mono text-xs outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none"
          :class="
            index === shown.length - 1
              ? 'shrink text-foreground'
              : 'max-w-32 shrink-[2] text-ink-muted hover:text-foreground'
          "
          :aria-current="index === shown.length - 1 ? 'location' : undefined"
          :disabled="!connected"
          @click="crumb.path !== directory && emit('navigate', crumb.path)"
        >
          {{ crumb.label }}
        </button>
      </template>
    </nav>
    <div class="h-full min-w-2 flex-1" @dblclick="edit" />
    <Button
      ref="pencil"
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Modifier le chemin distant"
      title="Modifier le chemin"
      :disabled="!connected"
      @click="edit"
    >
      <Pencil :stroke-width="1.5" />
    </Button>
  </div>
</template>
