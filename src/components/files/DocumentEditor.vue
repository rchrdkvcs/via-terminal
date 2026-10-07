<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Save } from '@lucide/vue'
import { useFiles } from '@/stores/files'
import { isDirty } from '@/stores/file-documents'
import { useFileProtection } from '@/composables/useFileProtection'
import { useFileDialogs } from '@/stores/file-dialogs'
import DocumentTabs from './DocumentTabs.vue'
import TextEditor from './TextEditor.vue'
const props = defineProps<{ tabId: string; sessionId: string | null }>()
const files = useFiles(),
  protection = useFileProtection(),
  dialogs = useFileDialogs()
const id = useId()
const panel = computed(() => files.state(props.tabId))
const active = computed(() =>
  panel.value.documents.find((doc) => doc.id === panel.value.activeDocument),
)
const dirty = computed(() => !!active.value && isDirty(active.value))
const stale = computed(() => !!active.value && active.value.owner !== panel.value.owner)
const saved = ref<string | null>(null)
watch(
  () => [active.value?.id, active.value?.content],
  () => (saved.value = null),
)
async function save() {
  const document = active.value
  if (!document || !props.sessionId || stale.value) return
  if (await files.saveDocument(props.tabId, props.sessionId, document.id)) saved.value = document.id
}
async function conflict(choice: 'reload' | 'overwrite') {
  const document = active.value,
    session = props.sessionId,
    tabId = props.tabId
  if (!document || !session) return
  const answer = await dialogs.ask({
    title:
      choice === 'reload' ? 'Recharger la version distante ?' : 'Remplacer la version distante ?',
    description:
      document.resolvedPath +
      (choice === 'reload'
        ? '\nVos modifications non enregistrées de ce document seront perdues.'
        : '\nLes changements faits sur le serveur depuis l’ouverture seront remplacés par votre version.'),
    actions: [
      {
        label: choice === 'reload' ? 'Recharger et abandonner' : 'Remplacer la version distante',
        value: 'confirm',
        destructive: true,
      },
    ],
  })
  if (answer.choice !== 'confirm' || props.tabId !== tabId || props.sessionId !== session) return
  if (choice === 'reload') await files.reloadDocument(tabId, session, document.id)
  else await files.saveDocument(tabId, session, document.id, true)
}
const action =
  'material-control press rounded-md px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40'
</script>
<template>
  <section
    v-if="panel.documents.length"
    class="flex h-full min-h-0 flex-col border-t border-hairline"
    aria-label="Documents distants"
  >
    <DocumentTabs
      :documents="panel.documents"
      :active="panel.activeDocument"
      :panel="id"
      @select="files.selectDocument(tabId, $event)"
      @close="protection.closeDocument(tabId, $event)"
    />
    <div
      v-if="active"
      :id="id"
      role="tabpanel"
      :aria-labelledby="`${id}-tab-${active.id}`"
      class="flex min-h-0 flex-1 flex-col"
    >
      <div class="flex shrink-0 flex-wrap items-start gap-x-2 px-3 py-1.5">
        <p class="min-w-0 flex-1 basis-40 py-1 text-[11px] break-all text-ink-muted">
          <template v-if="active.resolvedPath !== active.path"
            >{{ active.path }} <span aria-hidden="true">→</span
            ><span class="sr-only">, lien vers</span> </template
          >{{ active.resolvedPath }}
        </p>
        <span role="status" class="py-1 text-[11px] whitespace-nowrap text-ink-muted">{{
          active.saving
            ? 'Enregistrement…'
            : saved === active.id && !dirty
              ? 'Enregistré'
              : dirty && !sessionId
                ? 'Reconnectez pour enregistrer'
                : ''
        }}</span>
        <button
          type="button"
          :class="[action, 'flex shrink-0 items-center gap-1.5']"
          :disabled="!sessionId || stale || active.saving || !dirty"
          @click="save"
        >
          <Save :size="12" aria-hidden="true" />Enregistrer
        </button>
      </div>
      <p v-if="stale" class="shrink-0 px-3 pb-2 text-xs">
        Ce document vient d’une connexion précédente (autre serveur ou compte). Il ne peut pas être
        enregistré ici : copiez vos modifications ou fermez-le.
      </p>
      <div v-if="active.error" class="shrink-0 px-3 pb-2 text-xs" role="alert">
        <p class="break-words">{{ active.error }}</p>
        <div v-if="active.conflict" class="mt-1.5 flex flex-wrap gap-2">
          <button type="button" :class="action" :disabled="!sessionId" @click="conflict('reload')">
            Recharger la version distante
          </button>
          <button
            type="button"
            :class="action"
            :disabled="!sessionId || stale"
            @click="conflict('overwrite')"
          >
            Remplacer la version distante
          </button>
        </div>
      </div>
      <TextEditor
        :key="active.id"
        :content="active.content"
        :path="active.resolvedPath"
        class="min-h-0 flex-1"
        @change="files.editDocument(tabId, active.id, $event)"
        @save="save"
      />
    </div>
  </section>
</template>
