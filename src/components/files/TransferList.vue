<script setup lang="ts">
import { computed, useId } from 'vue'
import { RotateCcw, X, Upload, Download } from '@lucide/vue'
import type { Transfer, TransferState } from '@/stores/files'
import { isActive, isFinished, isProgressing } from '@/stores/file-transfer-model'
const props = defineProps<{ transfers: Transfer[]; connected: boolean }>()
const emit = defineEmits<{ cancel: [id: string]; retry: [id: string]; clear: [] }>()
const labels: Record<TransferState, string> = {
  preparing: 'Préparation',
  running: 'En cours',
  conflict: 'Choix attendu',
  completed: 'Terminé',
  failed: 'Échec',
  cancelled: 'Annulé',
}
const finished = computed(() =>
  props.transfers.some((job) => isFinished(job.state) && !job.retryable),
)
const heading = useId()
const summary = computed(() => {
  const count = (state: TransferState) =>
    props.transfers.filter((job) => job.state === state).length
  const running = props.transfers.filter((job) => isProgressing(job.state)).length,
    failed = count('failed'),
    waiting = count('conflict')
  return [
    running && `${running} en cours`,
    waiting && `${waiting} en attente d’un choix`,
    failed && `${failed} en échec`,
  ]
    .filter(Boolean)
    .join(', ')
})
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const amount = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${number.format(bytes / 1024)} Ko`
    : `${number.format(bytes / 1024 / 1024)} Mo`
const name = (path: string) => path.split('/').pop() || path
const button =
  'press grid size-6 shrink-0 place-items-center rounded text-ink-muted hover:bg-row-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40'
</script>
<template>
  <section
    v-if="transfers.length"
    class="flex max-h-[min(12rem,35%)] shrink-0 flex-col border-t border-hairline text-xs"
    :aria-labelledby="heading"
  >
    <div class="flex shrink-0 items-center gap-2 px-4 pt-2">
      <h3 :id="heading" class="flex-1 font-medium">Transferts</h3>
      <button
        v-if="finished"
        type="button"
        class="rounded px-1 text-ink-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        @click="emit('clear')"
      >
        Effacer les terminés
      </button>
    </div>
    <p role="status" class="sr-only">{{ summary }}</p>
    <ul class="min-h-0 overflow-auto p-2 pt-1">
      <li v-for="transfer in transfers" :key="transfer.id" class="rounded-md px-2 py-1.5">
        <div class="flex items-center gap-2">
          <span
            class="shrink-0 text-ink-muted"
            :title="transfer.direction === 'download' ? 'Téléchargement' : 'Envoi'"
          >
            <Download v-if="transfer.direction === 'download'" :size="12" aria-hidden="true" />
            <Upload v-else :size="12" aria-hidden="true" />
            <span class="sr-only">{{
              transfer.direction === 'download' ? 'Téléchargement de' : 'Envoi de'
            }}</span>
          </span>
          <span class="min-w-0 flex-1 truncate" :title="transfer.path">{{
            name(transfer.path)
          }}</span>
          <span
            class="whitespace-nowrap tabular-nums"
            :class="transfer.state === 'failed' ? 'font-medium text-foreground' : 'text-ink-muted'"
            >{{
              isProgressing(transfer.state) && transfer.total
                ? `${amount(transfer.bytes)} / ${amount(transfer.total)}`
                : labels[transfer.state]
            }}</span
          >
          <button
            v-if="isActive(transfer.state)"
            type="button"
            :class="button"
            :aria-label="`Annuler le transfert de ${name(transfer.path)}`"
            title="Annuler"
            @click="emit('cancel', transfer.id)"
          >
            <X :size="12" />
          </button>
          <button
            v-else-if="transfer.state === 'failed' && transfer.retryable"
            type="button"
            :disabled="!connected"
            :class="button"
            :aria-label="`Réessayer le transfert de ${name(transfer.path)}`"
            :title="connected ? 'Réessayer' : 'Reconnectez le terminal pour réessayer'"
            @click="emit('retry', transfer.id)"
          >
            <RotateCcw :size="12" />
          </button>
        </div>
        <progress
          v-if="isProgressing(transfer.state)"
          class="mt-1 block h-1 w-full appearance-none overflow-hidden rounded-full bg-[var(--hairline-strong)] [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-foreground [&::-moz-progress-bar]:bg-foreground"
          :value="transfer.total ? transfer.bytes : undefined"
          :max="transfer.total || 1"
          :aria-label="`Progression de ${name(transfer.path)}`"
        />
        <p v-if="transfer.message" class="mt-1 break-words text-ink-muted">
          {{ transfer.message }}
        </p>
        <details v-if="transfer.skipped.length" class="mt-1 text-ink-muted">
          <summary
            class="cursor-default rounded focus-visible:outline-2 focus-visible:outline-ring"
          >
            {{
              transfer.skipped.length === 1
                ? '1 élément ignoré'
                : `${transfer.skipped.length} éléments ignorés`
            }}
          </summary>
          <ul class="mt-1 break-all">
            <li v-for="path in transfer.skipped" :key="path">{{ path }}</li>
          </ul>
        </details>
      </li>
    </ul>
  </section>
</template>
