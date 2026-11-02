<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronRight, Pencil } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { RemoteEntry } from '@/ipc/files'
import { collapse, crumbs, subdirectories, type Crumb } from './breadcrumb'
import FileCrumb from './FileCrumb.vue'
/**
 * The current directory as a breadcrumb: each folder opens a menu of the folders it holds, the
 * path's next one selected. The hidden middle (…) lists the folders it stands for. The pencil or
 * a double click on the bar turns it into an editable path, completed from the listed
 * subdirectories.
 */
const props = defineProps<{
  directory: string
  connected: boolean
  /** The current directory's listing. */
  entries?: readonly RemoteEntry[]
  /** Whether dot folders are listed. */
  hidden?: boolean
  /** Lists another directory without navigating to it. */
  browse?: (path: string) => Promise<readonly RemoteEntry[] | null>
}>()
const emit = defineEmits<{ navigate: [path: string] }>()
const editing = ref(false),
  path = ref(''),
  input = ref<HTMLInputElement>()
const pencil = ref<InstanceType<typeof Button>>()
const listId = `file-path-${Math.random().toString(36).slice(2)}`
const all = computed(() => crumbs(props.directory))
const shown = computed(() => collapse(all.value))
const directories = computed(() => subdirectories(props.entries ?? []).map((folder) => folder.path))
/** The crumb after `crumb` in the full path: the folder it continues into. */
const next = (crumb: Crumb) =>
  all.value[all.value.findIndex((item) => item.path === crumb.path) + 1]?.path
const here = computed(() => all.value[all.value.length - 1].path)
function lister(path: string) {
  return async () =>
    path === here.value ? (props.entries ?? []) : ((await props.browse?.(path)) ?? null)
}
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
      <option v-for="option in directories" :key="option" :value="option" />
    </datalist>
  </form>
  <div v-else class="flex h-7 min-w-0 flex-1 items-center" :title="directory" @dblclick.self="edit">
    <nav aria-label="Chemin distant" class="flex min-w-0 items-center overflow-hidden">
      <template v-for="(crumb, index) in shown" :key="Array.isArray(crumb) ? 'more' : crumb.path">
        <ChevronRight
          v-if="index > 0"
          :size="12"
          :stroke-width="1.5"
          class="shrink-0 text-ink-faint"
          aria-hidden="true"
        />
        <DropdownMenu v-if="Array.isArray(crumb)">
          <DropdownMenuTrigger
            class="h-6 shrink-0 rounded-[5px] px-1.5 font-mono text-xs text-ink-muted outline-none hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none data-[state=open]:bg-row-hover"
            aria-label="Dossiers masqués du chemin"
            :disabled="!connected"
          >
            …
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="max-w-80 min-w-40">
            <DropdownMenuItem
              v-for="folder in crumb"
              :key="folder.path"
              class="font-mono text-xs"
              @select="emit('navigate', folder.path)"
            >
              <span class="min-w-0 truncate">{{ folder.path }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <FileCrumb
          v-else
          :crumb="crumb"
          :selected="next(crumb)"
          :current="index === shown.length - 1"
          :connected="connected"
          :hidden="hidden ?? true"
          :list="lister(crumb.path)"
          @navigate="$event !== here && emit('navigate', $event)"
        />
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
