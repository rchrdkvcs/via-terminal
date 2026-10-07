<script setup lang="ts">
import { X } from '@lucide/vue'
import type { TabState } from '@/stores/sessions'
defineProps<{ state: TabState; error: string | null; connected: boolean }>()
const emit = defineEmits<{ connect: []; retry: []; dismiss: [] }>()
const action =
  'material-control press rounded-md px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring'
const pending = ['connecting', 'verifying', 'authenticating']
</script>
<template>
  <div v-if="!connected" class="shrink-0 px-3 py-3 text-xs text-ink-muted" role="status">
    <p v-if="pending.includes(state)">Connexion du terminal en cours…</p>
    <template v-else>
      <p>Les fichiers distants sont disponibles quand le terminal est connecté.</p>
      <button type="button" :class="[action, 'mt-2 text-foreground']" @click="emit('connect')">
        Connecter le terminal
      </button>
    </template>
  </div>
  <div v-if="error" role="alert" class="flex shrink-0 items-start gap-2 px-3 py-2 text-xs">
    <p class="min-w-0 flex-1 py-1 break-words">{{ error }}</p>
    <button v-if="connected" type="button" :class="action" @click="emit('retry')">
      Actualiser
    </button>
    <button
      type="button"
      class="press grid size-6 shrink-0 place-items-center rounded text-ink-muted hover:bg-row-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Masquer l’erreur"
      title="Masquer"
      @click="emit('dismiss')"
    >
      <X :size="12" />
    </button>
  </div>
</template>
