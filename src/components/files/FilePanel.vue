<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FileNavigation from './FileNavigation.vue'
import { useFiles } from '@/stores/files'
import { useSessions } from '@/stores/sessions'
import { useWorkbench } from '@/stores/workbench'
import type { Tab } from '@/ipc/types'
import type { RemoteEntry } from '@/ipc/files'
import { useFileOperations } from './useFileOperations'
import { useFileTransfers } from './useFileTransfers'
import FileList from './FileList.vue'
import FileToolbar from './FileToolbar.vue'
import TransferList from './TransferList.vue'
import FileStatus from './FileStatus.vue'
import FileDropZone from './FileDropZone.vue'
/** Beside the terminal, unless the tab itself shows the explorer. */
const props = defineProps<{ tab: Tab }>()
const files = useFiles(),
  sessions = useSessions(),
  workbench = useWorkbench()
const panel = computed(() => files.state(props.tab.id))
const session = computed(() => files.session(props.tab.id))
const docked = computed(() => props.tab.view?.kind !== 'files')
const selected = ref<string[]>([]),
  hidden = ref(true)
const context = { tabId: () => props.tab.id }
const operations = useFileOperations(context),
  transfers = useFileTransfers(context)
const selection = computed(() =>
  panel.value.entries.filter((entry) => selected.value.includes(entry.path)),
)
watch(
  () => [props.tab.id, session.value] as const,
  async ([id, sessionId]) => {
    selected.value = []
    if (sessionId) {
      const current = files.state(id)
      const saved = props.tab.view?.kind === 'files' ? props.tab.view.path : props.tab.remoteCwd
      const directory = current.directory === '.' ? (saved ?? '.') : current.directory
      await files.navigate(id, directory)
    }
  },
  { immediate: true },
)
watch(
  () => panel.value.directory,
  () => (selected.value = []),
)
function navigate(directory: string) {
  selected.value = []
  if (session.value) void files.navigate(props.tab.id, directory)
}
function open(entry: RemoteEntry) {
  if (entry.kind === 'directory' || entry.targetKind === 'directory') navigate(entry.path)
  else workbench.openView(props.tab, { kind: 'document', path: entry.path })
}
function detach() {
  const path = panel.value.directory
  workbench.openView(props.tab, { kind: 'files', path: path.startsWith('/') ? path : null })
  files.hide(props.tab.id)
}
</script>
<template>
  <FileDropZone
    :directory="panel.directory"
    class="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    :class="docked ? 'bg-rail' : 'bg-surface'"
    aria-label="Explorateur distant"
    @drop="transfers.drop"
  >
    <FileNavigation :panel="panel" :connected="!!session" @navigate="navigate">
      <FileToolbar
        :count="selection.length"
        :enabled="!!session && !panel.busy"
        :hidden="hidden"
        :docked="docked"
        @create="operations.create"
        @upload="transfers.upload"
        @download="transfers.download(selection)"
        @rename="operations.change(selection[0], 'move')"
        @chmod="operations.change(selection[0], 'chmod')"
        @remove="operations.remove(selection)"
        @hidden="hidden = !hidden"
        @detach="detach"
        @hide="files.hide(tab.id)"
      />
    </FileNavigation>
    <FileStatus
      :state="sessions.runtime(tab.id).state"
      :error="panel.error"
      :connected="!!session"
      :docked="docked"
      @connect="workbench.reconnect(tab.id)"
      @retry="navigate(panel.directory)"
      @dismiss="files.dismissError(tab.id)"
    />
    <div class="flex min-h-0 flex-1 flex-col">
      <FileList
        :entries="panel.entries"
        :selected="selected"
        :busy="panel.busy"
        :hidden="hidden"
        :connected="!!session"
        :failed="!!panel.error"
        @select-all="selected = $event"
        @open="open"
      />
    </div>
    <TransferList
      :transfers="files.transfers(tab.id)"
      :connected="!!session"
      @cancel="transfers.cancel"
      @retry="transfers.retry"
      @clear="files.clearFinishedTransfers(tab.id)"
    />
  </FileDropZone>
</template>
