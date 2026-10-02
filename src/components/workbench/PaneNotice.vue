<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Server, SquareTerminal, Zap } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import type { Tab } from '@/ipc/types'
import { useTabClosing } from '@/composables/useTabClosing'
import { useTabLabel } from '@/composables/useTabLabel'
import { useSessions } from '@/stores/sessions'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'

/** An asleep or failed tab: what it is, and the one obvious next step. */
const props = defineProps<{ tab: Tab; mode: 'asleep' | 'failed' }>()
const sessions = useSessions()
const ui = useUi()
const workbench = useWorkbench()
const closing = useTabClosing()
const names = useTabLabel()

const remote = computed(() => props.tab.target.kind !== 'local')
const icon = computed(() =>
  props.mode === 'failed'
    ? AlertTriangle
    : props.tab.target.kind === 'local'
      ? SquareTerminal
      : props.tab.target.kind === 'host'
        ? Server
        : Zap,
)
const wake = () => workbench.reconnect(props.tab.id)
const editHost = () =>
  props.tab.target.kind === 'host' && ui.showVault('hosts', props.tab.target.hostId)
</script>

<template>
  <div
    class="flex flex-col items-center gap-4 text-center"
    :role="mode === 'failed' ? 'alert' : undefined"
  >
    <span
      class="material-control grid size-12 place-items-center rounded-[13px]"
      :class="mode === 'failed' ? 'text-state-error' : 'text-ink-muted'"
    >
      <component :is="icon" :size="20" :stroke-width="1.5" />
    </span>
    <div class="space-y-1">
      <h2 class="text-[15px] font-semibold tracking-[-0.01em]">
        <template v-if="mode === 'asleep'">{{ names.label(tab) }}</template>
        <template v-else>{{
          remote ? 'Connexion impossible' : 'Le terminal n’a pas démarré'
        }}</template>
      </h2>
      <p class="max-w-[340px] text-[13px] text-pretty text-ink-muted">
        {{ mode === 'asleep' ? names.detail(tab) : sessions.runtime(tab.id).message }}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <Button @click="wake">
        {{ mode === 'failed' ? 'Réessayer' : remote ? 'Se connecter' : 'Démarrer' }}
        <Kbd class="ms-1 bg-transparent text-current opacity-60 shadow-none">Entrée</Kbd>
      </Button>
      <Button
        v-if="mode === 'failed' && tab.target.kind === 'host'"
        variant="secondary"
        @click="editHost"
      >
        Modifier l’hôte
      </Button>
      <Button v-if="mode === 'failed'" variant="ghost" @click="closing.close(tab.id)"
        >Fermer l’onglet</Button
      >
    </div>
  </div>
</template>
