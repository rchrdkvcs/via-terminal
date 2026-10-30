<script setup lang="ts">
import { ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import { RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { useSettings } from '@/stores/settings'

const settings = useSettings()
const confirming = ref(false)
const { start: armTimeout, stop: disarm } = useTimeoutFn(() => (confirming.value = false), 4000, {
  immediate: false,
})

function onReset() {
  if (!confirming.value) {
    confirming.value = true
    armTimeout()
    return
  }
  disarm()
  confirming.value = false
  settings.reset()
  notify.success('Réglages rétablis')
}
</script>

<template>
  <div>
    <Button
      :variant="confirming ? 'destructive' : 'ghost'"
      size="sm"
      :class="confirming ? '' : 'text-ink-muted'"
      :title="confirming ? 'Tous les réglages reprendront leur valeur initiale.' : undefined"
      @click="onReset"
    >
      <RotateCcw :stroke-width="1.5" aria-hidden="true" />
      {{ confirming ? 'Confirmer : tout rétablir' : 'Rétablir tous les réglages par défaut' }}
    </Button>
    <span class="sr-only" aria-live="polite">
      {{ confirming ? 'Tous les réglages reprendront leur valeur initiale.' : '' }}
    </span>
  </div>
</template>
