<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import FileNavigation from './FileNavigation.vue'
import { useFiles } from '@/stores/files'
import { useSessions } from '@/stores/sessions'
import { useWorkbench } from '@/stores/workbench'
import { useTabLabel } from '@/composables/useTabLabel'
import type { Tab } from '@/ipc/types'
import type { RemoteEntry } from '@/ipc/files'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useFileOperations } from './useFileOperations'
import { useFileTransfers } from './useFileTransfers'
import DocumentEditor from './DocumentEditor.vue'
import FileList from './FileList.vue'
import FileToolbar from './FileToolbar.vue'
import TransferList from './TransferList.vue'
import FileStatus from './FileStatus.vue'
import FileDropZone from './FileDropZone.vue'
const props = defineProps<{ tab: Tab }>()
const files = useFiles(),
  sessions = useSessions(),
  workbench = useWorkbench(),
  names = useTabLabel()
const panel = computed(() => files.state(props.tab.id))
const session = computed(() =>
  sessions.runtime(props.tab.id).state === 'ready'
    ? sessions.runtime(props.tab.id).sessionId
    : null,
)
const editorPane = ref<{ resize: (size: number) => void }>()
watch(
  () => !!panel.value.documents.length,
  async (shown) => {
    await nextTick()
    if (shown) editorPane.value?.resize(60)
  },
)
const selected = ref<string[]>([]),
  hidden = ref(true)
const context = { tabId: () => props.tab.id, sessionId: () => session.value }
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
      const directory = current.directory === '.' ? (props.tab.remoteCwd ?? '.') : current.directory
      await files.navigate(id, sessionId, directory)
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
  if (session.value) void files.navigate(props.tab.id, session.value, directory)
}
function select(entry: string, checked: boolean) {
  selected.value = checked
    ? [...new Set([...selected.value, entry])]
    : selected.value.filter((path) => path !== entry)
}
function open(entry: RemoteEntry) {
  if (entry.kind === 'directory' || entry.targetKind === 'directory') navigate(entry.path)
  else if (session.value) void files.openDocument(props.tab.id, session.value, entry.path)
}
</script>
<template>
  <FileDropZone
    :directory="panel.directory"
    class="relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-rail"
    aria-label="Explorateur distant"
    @drop="transfers.drop"
  >
    <FileNavigation
      :name="names.label(tab)"
      :panel="panel"
      :connected="!!session"
      :hidden="hidden"
      @navigate="navigate"
      @hidden="hidden = !hidden"
      @expand="files.toggleExpanded(tab.id)"
      @hide="files.hide(tab.id)"
    />
    <FileToolbar
      :count="selection.length"
      :enabled="!!session && !panel.busy"
      @create="operations.create"
      @upload="transfers.upload"
      @download="transfers.download(selection)"
      @rename="operations.change(selection[0], 'move')"
      @chmod="operations.change(selection[0], 'chmod')"
      @remove="operations.remove(selection)"
    />
    <FileStatus
      :state="sessions.runtime(tab.id).state"
      :error="panel.error"
      :connected="!!session"
      @connect="workbench.reconnect(tab.id)"
      @retry="navigate(panel.directory)"
      @dismiss="files.dismissError(tab.id)"
    />
    <ResizablePanelGroup
      direction="vertical"
      class="flex-1"
      :class="panel.documents.length ? 'min-h-72' : 'min-h-40'"
    >
      <ResizablePanel :min-size="15">
        <div class="flex h-full min-h-0 flex-col">
          <FileList
            :entries="panel.entries"
            :selected="selected"
            :busy="panel.busy"
            :hidden="hidden"
            :connected="!!session"
            :failed="!!panel.error"
            @select="select"
            @select-all="selected = $event"
            @open="open"
          />
        </div>
      </ResizablePanel>
      <template v-if="panel.documents.length"
        ><ResizableHandle
          class="bg-hairline"
          aria-label="Redimensionner l’éditeur" /><ResizablePanel
          ref="editorPane"
          :default-size="60"
          :min-size="20"
          ><DocumentEditor :tab-id="tab.id" :session-id="session" /></ResizablePanel
      ></template>
    </ResizablePanelGroup>
    <TransferList
      :transfers="panel.transfers"
      :connected="!!session"
      @cancel="transfers.cancel"
      @retry="transfers.retry"
      @clear="files.clearFinishedTransfers(tab.id)"
    />
  </FileDropZone>
</template>
