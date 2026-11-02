<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Check, FolderOpen } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { RemoteEntry } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { subdirectories, type Crumb } from './breadcrumb'
/**
 * One folder of the breadcrumb. Its menu lists the folders it holds, the one the path continues
 * into marked as selected, and opens the folder itself unless it is the current one.
 */
const props = defineProps<{
  crumb: Crumb
  /** The next folder of the path, inside this one. */
  selected?: string
  current: boolean
  connected: boolean
  hidden: boolean
  /** Lists this folder; `null` when the reply no longer applies. */
  list: () => Promise<readonly RemoteEntry[] | null>
}>()
const emit = defineEmits<{ navigate: [path: string] }>()
const folders = ref<Crumb[]>([]),
  loading = ref(false),
  error = ref<string | null>(null),
  menu = ref<HTMLElement>()
let request: symbol | undefined
const shown = computed(() =>
  folders.value.filter(
    (folder) => props.hidden || !folder.label.startsWith('.') || folder.path === props.selected,
  ),
)
async function load() {
  const own = (request = Symbol())
  loading.value = true
  error.value = null
  try {
    const entries = await props.list()
    if (request !== own) return
    folders.value = entries ? subdirectories(entries) : []
  } catch (cause) {
    if (request === own) error.value = describeError(cause)
  } finally {
    if (request === own) loading.value = false
  }
  await nextTick()
  // After the menu has focused its first item.
  requestAnimationFrame(() => {
    const item = menu.value?.querySelector<HTMLElement>('[data-crumb-selected]')
    item?.focus()
    item?.scrollIntoView?.({ block: 'nearest' })
  })
}
function toggle(open: boolean) {
  if (open) void load()
  else request = undefined
}
</script>
<template>
  <DropdownMenu @update:open="toggle">
    <DropdownMenuTrigger
      class="h-6 min-w-0 truncate rounded-[5px] px-1.5 font-mono text-xs outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none data-[state=open]:bg-row-hover data-[state=open]:text-foreground"
      :class="
        current
          ? 'shrink text-foreground'
          : 'max-w-32 shrink-[2] text-ink-muted hover:text-foreground'
      "
      :aria-current="current ? 'location' : undefined"
      :aria-label="`${crumb.path} : dossiers`"
      :disabled="!connected"
    >
      {{ crumb.label }}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="max-w-80 min-w-48">
      <div ref="menu">
        <template v-if="!current">
          <DropdownMenuItem @select="emit('navigate', crumb.path)">
            <FolderOpen :stroke-width="1.5" />
            <span class="min-w-0 truncate"
              >Ouvrir <span class="font-mono">{{ crumb.label }}</span></span
            >
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>
        <div v-if="loading && !folders.length" class="px-2 py-1.5 text-xs text-ink-muted">
          Chargement…
        </div>
        <div v-else-if="error" role="alert" class="px-2 py-1.5 text-xs text-destructive">
          {{ error }}
        </div>
        <div v-else-if="!shown.length" class="px-2 py-1.5 text-xs text-ink-muted">
          Aucun dossier
        </div>
        <DropdownMenuItem
          v-for="folder in shown"
          :key="folder.path"
          :data-crumb-selected="folder.path === selected ? '' : undefined"
          :aria-current="folder.path === selected ? 'location' : undefined"
          class="font-mono text-xs"
          :class="folder.path === selected ? 'bg-row-selected text-foreground' : ''"
          @select="emit('navigate', folder.path)"
        >
          <Check :stroke-width="1.5" :class="folder.path === selected ? '' : 'invisible'" />
          <span class="min-w-0 truncate">{{ folder.label }}</span>
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
