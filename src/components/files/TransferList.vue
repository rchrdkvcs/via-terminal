<script setup lang="ts">
import { RotateCcw, X } from '@lucide/vue'
import type { TransferEvent } from '@/ipc/files'
defineProps<{ transfers: TransferEvent[]; connected: boolean }>()
const emit = defineEmits<{ cancel: [id: string]; retry: [id: string] }>()
const labels = {
  running: 'En cours',
  conflict: 'Choix attendu',
  completed: 'Terminé',
  failed: 'Échec',
  cancelled: 'Annulé',
}
</script>
<template>
  <div
    v-if="transfers.length"
    class="max-h-40 shrink-0 overflow-auto border-t border-hairline p-2 text-xs"
    aria-label="Transferts"
  >
    <div v-for="transfer in transfers" :key="transfer.id" class="rounded-md px-2 py-1.5">
      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate" :title="transfer.path">{{
          transfer.path.split('/').pop()
        }}</span
        ><span class="text-ink-muted">{{ labels[transfer.state] }}</span>
        <button
          v-if="['running', 'conflict'].includes(transfer.state)"
          class="grid size-6 place-items-center rounded hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Annuler ce transfert"
          @click="emit('cancel', transfer.id)"
        >
          <X :size="12" />
        </button>
        <button
          v-else-if="transfer.state === 'failed'"
          :disabled="!connected"
          class="grid size-6 place-items-center rounded hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Réessayer ce transfert"
          @click="emit('retry', transfer.id)"
        >
          <RotateCcw :size="12" />
        </button>
      </div>
      <progress
        v-if="transfer.state === 'running'"
        class="mt-1 h-1 w-full accent-foreground"
        :value="transfer.total ? transfer.bytes : undefined"
        :max="transfer.total || 1"
        aria-label="Progression du fichier"
      />
      <p v-if="transfer.message" role="status" class="mt-1 break-words text-ink-muted">
        {{ transfer.message }}
      </p>
      <details v-if="transfer.skipped.length" class="mt-1 text-ink-muted">
        <summary>{{ transfer.skipped.length }} éléments ignorés</summary>
        <ul class="mt-1 break-words">
          <li v-for="path in transfer.skipped" :key="path">{{ path }}</li>
        </ul>
      </details>
    </div>
  </div>
</template>
