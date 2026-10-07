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
  hidden = ref(true),
  dragging = ref(false)
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
  () => {
    selected.value = []
  },
  { immediate: true },
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
function accepts(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  event.stopPropagation()
  dragging.value = true
}
async function drop(event: DragEvent) {
  dragging.value = false
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
    event.stopPropagation()
    await transfers.drop(event)
  }
}
</script>
<template>
  <section
    class="relative flex h-full min-h-0 min-w-0 flex-col bg-surface"
    aria-label="Explorateur distant"
    @dragenter="accepts"
    @dragover="accepts"
    @dragleave="dragging = false"
    @drop="drop"
  >
    <FileNavigation
      :name="names.label(tab)"
      :panel="panel"
      :connected="!!session"
      :hidden="hidden"
      @navigate="navigate"
      @hidden="hidden = !hidden"
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
    <div v-if="!session" class="shrink-0 px-3 py-3 text-xs text-ink-muted">
      <p>Connectez le terminal pour accéder aux fichiers.</p>
      <button class="mt-2 underline" @click="workbench.reconnect(tab.id)">Connecter</button>
    </div>
    <p v-if="panel.error" role="alert" class="shrink-0 break-words px-3 py-2 text-xs">
      {{ panel.error }}
    </p>
    <ResizablePanelGroup direction="vertical" class="min-h-0 flex-1">
      <ResizablePanel :default-size="panel.documents.length ? 40 : 100" :min-size="15">
        <div class="flex h-full min-h-0 flex-col">
          <FileList
            :entries="panel.entries"
            :selected="selected"
            :busy="panel.busy"
            :hidden="hidden"
            @select="select"
            @open="open"
          />
        </div>
      </ResizablePanel>
      <template v-if="panel.documents.length"
        ><ResizableHandle aria-label="Redimensionner l’éditeur" /><ResizablePanel
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
    />
    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-2 grid place-items-center rounded-lg border-2 border-dashed border-ring bg-surface/90 text-sm"
    >
      Déposer dans {{ panel.directory }}
    </div>
  </section>
</template>
