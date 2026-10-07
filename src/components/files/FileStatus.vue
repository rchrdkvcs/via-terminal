<script setup lang="ts">
import { X } from '@lucide/vue'
import type { TabState } from '@/stores/sessions'
import { Button } from '@/components/ui/button'
defineProps<{ state: TabState; error: string | null; connected: boolean }>()
const emit = defineEmits<{ connect: []; retry: []; dismiss: [] }>()
const pending = ['connecting', 'verifying', 'authenticating']
</script>
<template>
  <div v-if="!connected" class="shrink-0 px-3 py-3 text-xs text-ink-muted" role="status">
    <p v-if="pending.includes(state)">Connexion du terminal en cours…</p>
    <template v-else>
      <p>Les fichiers distants sont disponibles quand le terminal est connecté.</p>
      <Button type="button" size="sm" class="mt-2" @click="emit('connect')">
        Connecter le terminal
      </Button>
    </template>
  </div>
  <div
    v-if="error"
    role="alert"
    class="flex shrink-0 items-start gap-1.5 border-b border-hairline py-1.5 ps-3 pe-2 text-xs"
  >
    <p class="min-w-0 flex-1 py-1 break-words">{{ error }}</p>
    <Button v-if="connected" type="button" variant="secondary" size="xs" @click="emit('retry')">
      Actualiser
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Masquer l’erreur"
      title="Masquer"
      @click="emit('dismiss')"
    >
      <X :stroke-width="1.5" />
    </Button>
  </div>
</template>
