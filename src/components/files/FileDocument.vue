<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DocumentEditor from './DocumentEditor.vue'
/** A document shown in place of a docked or dialog explorer's list, until going back to it. */
const props = defineProps<{ tabId: string; path: string }>()
const emit = defineEmits<{ back: [] }>()
const name = (path: string) => path.split('/').filter(Boolean).pop() ?? path
</script>
<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <header class="flex shrink-0 items-center gap-1 border-b border-hairline p-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Retour aux fichiers"
        title="Retour aux fichiers"
        @click="emit('back')"
      >
        <ArrowLeft :stroke-width="1.5" />
      </Button>
      <h3 class="min-w-0 truncate text-xs font-medium">{{ name(props.path) }}</h3>
    </header>
    <DocumentEditor :tab-id="tabId" :path="path" class="min-h-0 flex-1" />
  </div>
</template>
