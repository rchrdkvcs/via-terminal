<script setup lang="ts">
import { computed } from 'vue'
import { Save, X } from '@lucide/vue'
import { useFiles } from '@/stores/files'
import { useFileProtection } from '@/composables/useFileProtection'
import { useFileDialogs } from '@/stores/file-dialogs'
import TextEditor from './TextEditor.vue'
const props = defineProps<{ tabId: string; sessionId: string | null }>()
const files = useFiles(),
  protection = useFileProtection(),
  dialogs = useFileDialogs()
const panel = computed(() => files.state(props.tabId))
const active = computed(() =>
  panel.value.documents.find((doc) => doc.id === panel.value.activeDocument),
)
async function save() {
  if (active.value && props.sessionId)
    await files.saveDocument(props.tabId, props.sessionId, active.value.id)
}
async function conflict(choice: 'reload' | 'overwrite') {
  const document = active.value,
    session = props.sessionId,
    tabId = props.tabId
  if (!document || !session) return
  const answer = await dialogs.ask({
    title:
      choice === 'reload'
        ? 'Abandonner vos modifications et recharger ?'
        : 'Remplacer la version distante ?',
    description: document.path,
    actions: [
      {
        label: choice === 'reload' ? 'Recharger' : 'Remplacer',
        value: 'confirm',
        destructive: true,
      },
    ],
  })
  if (answer.choice !== 'confirm' || props.tabId !== tabId || props.sessionId !== session) return
  if (choice === 'reload') await files.reloadDocument(tabId, session, document.id)
  else await files.saveDocument(tabId, session, document.id, true)
}
</script>
<template>
  <section
    v-if="panel.documents.length"
    class="flex h-full min-h-0 flex-col border-t border-hairline"
    aria-label="Documents distants"
  >
    <div
      class="flex shrink-0 items-center overflow-x-auto border-b border-hairline px-1"
      role="tablist"
      aria-label="Documents ouverts"
    >
      <div
        v-for="document in panel.documents"
        :key="document.id"
        class="flex shrink-0 items-center rounded-t-md"
        :class="active?.id === document.id ? 'bg-row-selected' : ''"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="active?.id === document.id"
          class="max-w-40 truncate px-2 py-2 text-xs focus-visible:outline-2 focus-visible:outline-ring"
          :title="document.path"
          @click="panel.activeDocument = document.id"
        >
          {{ document.path.split('/').pop()
          }}{{ document.content !== document.original ? ' •' : '' }}
        </button>
        <button
          class="me-1 grid size-6 place-items-center rounded hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-ring"
          :aria-label="`Fermer ${document.path}`"
          :disabled="document.saving"
          @click="protection.closeDocument(tabId, document.id)"
        >
          <X :size="12" />
        </button>
      </div>
    </div>
    <template v-if="active">
      <div class="flex shrink-0 items-center gap-2 px-3 py-1.5">
        <span
          class="min-w-0 flex-1 truncate text-[11px] text-ink-muted"
          :title="active.resolvedPath"
          >{{ active.resolvedPath }}</span
        ><button
          class="material-control flex items-center gap-1.5 rounded-md px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          :disabled="!sessionId || active.saving || active.content === active.original"
          @click="save"
        >
          <Save :size="12" />{{ active.saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
      <div v-if="active.error" class="shrink-0 px-3 pb-2 text-xs" role="alert">
        <p>{{ active.error }}</p>
        <div v-if="active.conflict" class="mt-1 flex gap-3">
          <button class="underline" @click="conflict('reload')">Recharger</button
          ><button class="underline" @click="conflict('overwrite')">Remplacer explicitement</button>
        </div>
      </div>
      <TextEditor
        :key="active.id"
        :content="active.content"
        :path="active.resolvedPath"
        class="min-h-0 flex-1"
        @change="active.content = $event"
        @save="save"
      />
    </template>
  </section>
</template>
