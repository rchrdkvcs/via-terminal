<script setup lang="ts">
import { computed, watch } from 'vue'
import { X } from '@lucide/vue'
import { DialogClose, DialogDescription, DialogTitle } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { findTab } from '@/domain/space'
import { useFileProtection } from '@/composables/useFileProtection'
import { useTabLabel } from '@/composables/useTabLabel'
import { useFiles } from '@/stores/files'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import DocumentEditor from './DocumentEditor.vue'
import FilePanel from './FilePanel.vue'

/** A remote explorer or document over the workbench, through the connection of its tab. */
const ui = useUi()
const files = useFiles()
const spaces = useSpaces()
const names = useTabLabel()
const protection = useFileProtection()

const tab = computed(() => {
  const id = ui.filesDialog?.tabId
  const space = id ? spaces.spaceOf(id) : undefined
  return space && id ? findTab(space, id) : undefined
})
// Closing or replacing the tab takes its explorer away; its drafts were protected then.
watch(tab, (current) => {
  if (!current && ui.filesDialog) ui.filesDialog = null
})

const title = computed(() => {
  const dialog = ui.filesDialog
  if (!dialog || !tab.value) return ''
  return dialog.kind === 'document'
    ? dialog.path
    : `Explorateur distant · ${names.label(tab.value)}`
})

/** The document the dialog shows, alone or in place of its explorer's list. */
function shownDocument(): boolean {
  const dialog = ui.filesDialog
  return !!dialog && (dialog.kind === 'document' || !!files.state(dialog.tabId).opened)
}

async function close() {
  const dialog = ui.filesDialog
  if (!dialog) return
  if (shownDocument() && !(await protection.closeDocument(dialog.tabId))) return
  if (ui.filesDialog === dialog) ui.filesDialog = null
}

const busy = 'input, textarea, select, [contenteditable]'
/** Escape stays with the field or editor that has the focus. */
function onEscape(event: KeyboardEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (event.defaultPrevented || target?.closest(busy)) event.preventDefault()
}
</script>

<template>
  <Dialog v-if="ui.filesDialog && tab" :open="true" @update:open="(open) => !open && close()">
    <DialogContent
      :show-close-button="false"
      overlay-class="backdrop-blur-sm"
      class="flex h-[min(780px,calc(100%-4rem))] w-[min(1120px,calc(100%-4rem))] max-w-none flex-col gap-0 overflow-hidden p-0 text-[13px] text-foreground outline-none sm:max-w-none"
      @escape-key-down="onEscape"
    >
      <header class="flex h-11 shrink-0 items-center gap-3 border-b border-hairline ps-4 pe-2">
        <DialogTitle class="min-w-0 flex-1 truncate text-[13px] font-medium">{{
          title
        }}</DialogTitle>
        <DialogDescription class="sr-only">Appuyez sur Échap pour fermer.</DialogDescription>
        <DialogClose as-child>
          <Button variant="ghost" size="icon-sm" aria-label="Fermer" title="Fermer (Échap)">
            <X :stroke-width="1.5" aria-hidden="true" />
          </Button>
        </DialogClose>
      </header>
      <div class="relative flex min-h-0 flex-1 flex-col bg-surface">
        <DocumentEditor
          v-if="ui.filesDialog.kind === 'document'"
          :tab-id="tab.id"
          :path="ui.filesDialog.path"
        />
        <FilePanel v-else :tab="tab" dialog @close="close" />
      </div>
    </DialogContent>
  </Dialog>
</template>
