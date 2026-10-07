<script setup lang="ts">
import { computed, useId } from 'vue'
import { RotateCcw, X, Upload, Download } from '@lucide/vue'
import type { Transfer, TransferState } from '@/stores/files'
import { isActive, isFinished, isProgressing } from '@/stores/file-transfer-model'
import { Button } from '@/components/ui/button'
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
</script>
<template>
  <section
    v-if="transfers.length"
    class="flex max-h-[min(12rem,35%)] shrink-0 flex-col border-t border-hairline text-xs"
    :aria-labelledby="heading"
  >
    <div class="flex h-9 shrink-0 items-center gap-2 ps-3 pe-2">
      <h3 :id="heading" class="flex-1 font-medium">Transferts</h3>
      <Button v-if="finished" type="button" variant="ghost" size="xs" @click="emit('clear')">
        Effacer les terminés
      </Button>
    </div>
    <p role="status" class="sr-only">{{ summary }}</p>
    <ul class="min-h-0 overflow-auto px-2 pb-2">
      <li v-for="transfer in transfers" :key="transfer.id" class="px-1 py-1.5">
        <div class="flex min-h-6 items-center gap-2">
          <span
            class="shrink-0 text-ink-muted"
            :title="transfer.direction === 'download' ? 'Téléchargement' : 'Envoi'"
          >
            <Download
              v-if="transfer.direction === 'download'"
              :size="12"
              :stroke-width="1.5"
              aria-hidden="true"
            />
            <Upload v-else :size="12" :stroke-width="1.5" aria-hidden="true" />
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
          <Button
            v-if="isActive(transfer.state)"
            type="button"
            variant="ghost"
            size="icon-xs"
            :aria-label="`Annuler le transfert de ${name(transfer.path)}`"
            title="Annuler"
            @click="emit('cancel', transfer.id)"
          >
            <X :stroke-width="1.5" />
          </Button>
          <span
            v-else-if="transfer.state === 'failed' && transfer.retryable"
            :title="connected ? 'Réessayer' : 'Reconnectez le terminal pour réessayer'"
            class="shrink-0"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              :disabled="!connected"
              :aria-label="`Réessayer le transfert de ${name(transfer.path)}`"
              @click="emit('retry', transfer.id)"
            >
              <RotateCcw :stroke-width="1.5" />
            </Button>
          </span>
        </div>
        <progress
          v-if="isProgressing(transfer.state)"
          class="mt-1 block h-1 w-full appearance-none overflow-hidden rounded-full bg-hairline [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-foreground [&::-moz-progress-bar]:bg-foreground"
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
