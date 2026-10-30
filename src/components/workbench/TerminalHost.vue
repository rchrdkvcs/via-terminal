<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import {
  ClipboardPaste,
  Columns2,
  Copy,
  Eraser,
  FolderTree,
  Search,
  TextSelect,
  Unlink,
  X,
} from '@lucide/vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Id } from '@/ipc/types'
import { findTab, splitOf } from '@/domain/space'
import { useClosing } from '@/composables/useClosing'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { terminals } from '@/terminal/registry'
import { useFiles } from '@/stores/files'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'

const props = defineProps<{ tabId: Id }>()
const host = ref<HTMLElement>()
const spaces = useSpaces()
const ui = useUi()
const files = useFiles()
const workbench = useWorkbench()
const closing = useClosing()
const kbd = useShortcutLabel()

onMounted(() => host.value && terminals.attach(props.tabId, host.value))
onBeforeUnmount(() => terminals.detach(props.tabId))
watch(
  () => props.tabId,
  (next, previous) => {
    terminals.detach(previous)
    if (host.value) terminals.attach(next, host.value)
  },
)
useResizeObserver(host, () => terminals.refit(props.tabId))

const remote = computed(() => {
  const target = findTab(spaces.active, props.tabId)?.target
  return !!target && target.kind !== 'local'
})
const inSplit = computed(() => Boolean(splitOf(spaces.active, props.tabId)))
const selection = ref('')

/** Shift + right click reaches the menu even while a program reads the mouse. */
function guard(event: MouseEvent) {
  if (event.isTrusted && !event.shiftKey && terminals.capturesMouse(props.tabId))
    event.preventDefault()
}

function opened(open: boolean) {
  if (open) selection.value = terminals.selection(props.tabId)
}

function copy() {
  void navigator.clipboard.writeText(selection.value)
}

/** Focus goes back to the terminal unless the action moved it (search, command bar). */
function refocus(event: Event) {
  event.preventDefault()
  const active = document.activeElement
  if (!active || active === document.body || active.closest('[role="menu"]'))
    terminals.focus(props.tabId)
}

function paste() {
  void navigator.clipboard.readText().then((text) => terminals.paste(props.tabId, text))
}

function showFiles() {
  files.setVisible(props.tabId, true)
}
</script>

<template>
  <ContextMenu @update:open="opened">
    <ContextMenuTrigger as-child>
      <div ref="host" class="h-full w-full [contain:strict]" @contextmenu="guard" />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-60" @close-auto-focus="refocus">
      <ContextMenuItem :disabled="!selection" @select="copy">
        <Copy :stroke-width="1.5" /> Copier
        <ContextMenuShortcut>{{ kbd('copy') }}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="paste">
        <ClipboardPaste :stroke-width="1.5" /> Coller
        <ContextMenuShortcut>{{ kbd('paste') }}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="terminals.selectAll(tabId)">
        <TextSelect :stroke-width="1.5" /> Tout sélectionner
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @select="ui.searching = true">
        <Search :stroke-width="1.5" /> Rechercher…
        <ContextMenuShortcut>{{ kbd('search') }}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="terminals.clear(tabId)">
        <Eraser :stroke-width="1.5" /> Effacer l’historique
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem v-if="remote" @select="showFiles">
        <FolderTree :stroke-width="1.5" /> Ouvrir l’explorateur distant
      </ContextMenuItem>
      <ContextMenuItem v-if="!inSplit" @select="ui.openCommand({ kind: 'split', tabId })">
        <Columns2 :stroke-width="1.5" /> Partager la vue avec…
        <ContextMenuShortcut>{{ kbd('split') }}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem v-else @select="workbench.detach(tabId)">
        <Unlink :stroke-width="1.5" /> Détacher de la vue partagée
      </ContextMenuItem>
      <ContextMenuItem @select="closing.closeTab(tabId)">
        <X :stroke-width="1.5" /> Fermer l’onglet
        <ContextMenuShortcut>{{ kbd('closeTab') }}</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
