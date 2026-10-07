<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Save } from '@lucide/vue'
import { useFiles } from '@/stores/files'
import { isDirty } from '@/stores/file-documents'
import { useFileProtection } from '@/composables/useFileProtection'
import { useFileDialogs } from '@/stores/file-dialogs'
import DocumentTabs from './DocumentTabs.vue'
import TextEditor from './TextEditor.vue'
import { Button } from '@/components/ui/button'
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
</script>
<template>
  <section
    v-if="panel.documents.length"
    class="flex h-full min-h-0 flex-col"
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
      class="flex min-h-0 flex-1 flex-col bg-surface text-surface-ink"
    >
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
