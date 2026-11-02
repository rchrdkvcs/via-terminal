<script setup lang="ts">
import { ArrowLeft, RefreshCw } from '@lucide/vue'
import type { FileState } from '@/stores/files'
import { Button } from '@/components/ui/button'
import type { RemoteEntry } from '@/ipc/files'
import type { Target } from '@/ipc/types'
import FilePath from './FilePath.vue'
import FileUser from './FileUser.vue'
defineProps<{
  panel: FileState
  connected: boolean
  target?: Target
  docked?: boolean
  /** Whether dot folders are listed. */
  hidden?: boolean
  /** Lists another directory without navigating to it. */
  browse?: (path: string) => Promise<readonly RemoteEntry[] | null>
}>()
const emit = defineEmits<{ navigate: [path: string]; switchUser: [target: Target] }>()
const parent = (directory: string) => directory.replace(/\/[^/]+\/?$/, '') || '/'
</script>
<template>
  <header
    class="@container flex shrink-0 flex-wrap items-center gap-1 border-b border-hairline p-2"
    aria-label="Navigation et opérations sur les fichiers"
  >
    <FileUser
      v-if="target && target.kind !== 'local'"
      :target="target"
      :docked="docked ?? true"
      @switch="emit('switchUser', $event)"
    />
    <div
      class="material-field flex min-w-0 flex-1 basis-full items-center gap-0.5 rounded-md px-0.5 @[16rem]:basis-0"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Dossier parent"
        title="Dossier parent"
        :disabled="!connected || panel.directory === '/'"
        @click="emit('navigate', parent(panel.directory))"
      >
        <ArrowLeft :stroke-width="1.5" />
      </Button>
      <FilePath
        :directory="panel.directory"
        :connected="connected"
        :entries="panel.entries"
        :hidden="hidden"
        :browse="browse"
        @navigate="emit('navigate', $event)"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Actualiser les fichiers"
        title="Actualiser"
        :disabled="!connected || panel.busy"
        @click="emit('navigate', panel.directory)"
      >
        <RefreshCw
          :stroke-width="1.5"
          :class="panel.busy ? 'animate-spin motion-reduce:animate-none' : ''"
        />
      </Button>
    </div>
    <slot />
  </header>
</template>
