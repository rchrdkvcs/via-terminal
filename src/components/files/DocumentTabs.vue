<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { X } from '@lucide/vue'
import { isDirty, type RemoteDocument } from '@/stores/file-documents'
import { Button } from '@/components/ui/button'
const props = defineProps<{ documents: RemoteDocument[]; active: string | null; panel: string }>()
const emit = defineEmits<{ select: [id: string]; close: [id: string] }>()
const list = ref<HTMLElement>()
const name = (document: RemoteDocument) => document.path.split('/').pop() || document.path
async function move(event: KeyboardEvent, index: number) {
  if (event.key === 'Delete') {
    event.preventDefault()
    emit('close', props.documents[index].id)
    return
  }
  const last = props.documents.length - 1
  const target = {
    ArrowLeft: index ? index - 1 : last,
    ArrowRight: index === last ? 0 : index + 1,
    Home: 0,
    End: last,
  }[event.key]
  if (target === undefined) return
  event.preventDefault()
  emit('select', props.documents[target].id)
  await nextTick()
  list.value?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
}
</script>
<template>
  <div
    ref="list"
    class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-hairline px-2 py-1.5"
    role="tablist"
    aria-label="Documents ouverts"
  >
    <div
      v-for="(document, index) in documents"
      :key="document.id"
      role="presentation"
      class="row flex shrink-0 items-center text-ink-muted hover:text-foreground"
      :data-selected="active === document.id || undefined"
    >
      <button
        :id="`${panel}-tab-${document.id}`"
        type="button"
        role="tab"
        :aria-selected="active === document.id"
        :aria-controls="panel"
        :tabindex="active === document.id ? 0 : -1"
        aria-keyshortcuts="Delete"
        class="flex h-7 max-w-44 items-center gap-1.5 rounded-md ps-2 pe-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        :title="`${document.path}\nSuppr pour fermer`"
        @click="emit('select', document.id)"
        @keydown="move($event, index)"
      >
        <span class="truncate">{{ name(document) }}</span
        ><span
          v-if="isDirty(document)"
          class="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        /><span v-if="isDirty(document)" class="sr-only">, non enregistré</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        tabindex="-1"
        aria-hidden="true"
        class="me-0.5"
        :title="`Fermer ${name(document)}`"
        :disabled="document.saving"
        @mousedown.prevent
        @click="emit('close', document.id)"
      >
        <X :stroke-width="1.5" />
      </Button>
    </div>
  </div>
</template>
