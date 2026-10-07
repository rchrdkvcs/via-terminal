<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RefreshCw, Save } from '@lucide/vue'
import { useFiles } from '@/stores/files'
import { isDirty } from '@/stores/file-documents'
import { useFileDialogs } from '@/stores/file-dialogs'
import TextEditor from './TextEditor.vue'
import { Button } from '@/components/ui/button'
/** The remote document a tab shows in place of its terminal. */
const props = defineProps<{ tabId: string; path: string; sessionId: string | null }>()
const files = useFiles(),
  dialogs = useFileDialogs()
const panel = computed(() => files.state(props.tabId))
const active = computed(() => panel.value.documents.find((doc) => doc.path === props.path))
function load() {
  if (props.sessionId && !active.value) {
    files.dismissError(props.tabId)
    void files.openDocument(props.tabId, props.sessionId, props.path)
  }
}
watch(() => props.sessionId, load, { immediate: true })
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
</script>
<template>
  <section class="flex h-full min-h-0 flex-col" :aria-label="`Document distant ${path}`">
    <div
      v-if="!active"
      class="grid flex-1 place-items-center p-6 text-xs text-ink-muted"
      :role="panel.error ? 'alert' : 'status'"
    >
      <div v-if="panel.error" class="flex max-w-sm flex-col items-center gap-2 text-center">
        <p class="break-words">{{ panel.error }}</p>
        <Button type="button" variant="secondary" size="xs" :disabled="!sessionId" @click="load">
          <RefreshCw :stroke-width="1.5" aria-hidden="true" />Réessayer
        </Button>
      </div>
      <p v-else-if="sessionId">Ouverture de {{ path }}…</p>
    </div>
    <div v-else class="flex min-h-0 flex-1 flex-col bg-surface text-surface-ink">
      <div
        class="flex shrink-0 flex-wrap items-start gap-x-2 border-b border-hairline py-1.5 ps-3 pe-2"
      >
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
        <Button
          type="button"
          variant="secondary"
          size="xs"
          :disabled="!sessionId || stale || active.saving || !dirty"
          @click="save"
        >
          <Save :stroke-width="1.5" aria-hidden="true" />Enregistrer
        </Button>
      </div>
      <p v-if="stale" class="shrink-0 border-b border-hairline px-3 py-2 text-xs">
        Ce document vient d’une connexion précédente (autre serveur ou compte). Il ne peut pas être
        enregistré ici : copiez vos modifications ou fermez-le.
      </p>
      <div
        v-if="active.error"
        class="shrink-0 border-b border-hairline px-3 py-2 text-xs"
        role="alert"
      >
        <p class="break-words">{{ active.error }}</p>
        <div v-if="active.conflict" class="mt-2 flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            :disabled="!sessionId"
            @click="conflict('reload')"
          >
            Recharger la version distante
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            :disabled="!sessionId || stale"
            @click="conflict('overwrite')"
          >
            Remplacer la version distante
          </Button>
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
