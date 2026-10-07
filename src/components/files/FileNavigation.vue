<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowUp, AppWindow, Eye, EyeOff, RefreshCw, X } from '@lucide/vue'
import type { FileState } from '@/stores/files'
import { Button } from '@/components/ui/button'
const props = defineProps<{
  name: string
  panel: FileState
  connected: boolean
  hidden: boolean
  docked: boolean
}>()
const emit = defineEmits<{ navigate: [path: string]; hidden: []; detach: []; hide: [] }>()
const path = ref('')
watch(
  () => props.panel.directory,
  (directory) => {
    path.value = directory
  },
  { immediate: true },
)
const navigate = (directory: string) => emit('navigate', directory)
const parent = () => navigate(props.panel.directory.replace(/\/[^/]+\/?$/, '') || '/')
const pressed =
  'aria-pressed:bg-control aria-pressed:text-foreground aria-pressed:shadow-[var(--shadow-control)]'
</script>
<template>
  <header class="flex h-10 shrink-0 items-center gap-1 border-b border-hairline ps-3 pe-2">
    <h2 class="min-w-0 flex-1 truncate text-xs font-medium">Fichiers · {{ name }}</h2>
    <template v-if="docked">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Ouvrir l’explorateur distant dans un onglet"
        title="Ouvrir dans un onglet"
        @click="emit('detach')"
      >
        <AppWindow :stroke-width="1.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Masquer l’explorateur distant"
        title="Masquer"
        @click="emit('hide')"
      >
        <X :stroke-width="1.5" />
      </Button>
    </template>
  </header>
  <form
    class="@container flex shrink-0 flex-wrap items-center gap-1 px-2 pt-2"
    @submit.prevent="navigate(path)"
  >
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Dossier parent"
      title="Dossier parent"
      :disabled="!connected || panel.directory === '/'"
      @click="parent"
    >
      <ArrowUp :stroke-width="1.5" />
    </Button>
    <input
      v-model="path"
      aria-label="Chemin distant"
      spellcheck="false"
      class="material-field order-last h-7 min-w-0 flex-1 basis-full rounded-md @[16rem]:order-none @[16rem]:basis-0 px-2 font-mono text-xs text-foreground outline-none disabled:opacity-50"
      :disabled="!connected"
      @keydown.esc="path = panel.directory"
    />
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Actualiser les fichiers"
      title="Actualiser"
      :disabled="!connected || panel.busy"
      @click="navigate(panel.directory)"
    >
      <RefreshCw
        :stroke-width="1.5"
        :class="panel.busy ? 'animate-spin motion-reduce:animate-none' : ''"
      />
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      :class="pressed"
      aria-label="Afficher les fichiers cachés"
      title="Afficher les fichiers cachés"
      :aria-pressed="hidden"
      @click="emit('hidden')"
    >
      <Eye v-if="hidden" :stroke-width="1.5" /><EyeOff v-else :stroke-width="1.5" />
    </Button>
  </form>
</template>
