<script setup lang="ts">
import { computed } from 'vue'
import { Server, Terminal, Zap } from '@lucide/vue'
import type { Target } from '@/ipc/types'
import type { TabState } from '@/stores/sessions'

/**
 * What a tab connects to, and its state at a glance. Only connection progress
 * moves; a problem shows as a static dot so it never pulls the eye forever.
 */
const props = defineProps<{ target: Target; state: TabState }>()

const icon = computed(() =>
  props.target.kind === 'local' ? Terminal : props.target.kind === 'host' ? Server : Zap,
)
const pending = computed(() => ['connecting', 'verifying', 'authenticating'].includes(props.state))
const problem = computed(() => props.state === 'failed' || props.state === 'disconnected')
const label = computed(
  () =>
    ({
      asleep: 'en veille',
      connecting: 'connexion en cours',
      verifying: 'vérification du serveur',
      authenticating: 'authentification',
      ready: 'actif',
      exited: 'terminé',
      failed: 'échec',
      disconnected: 'déconnecté',
    })[props.state],
)
</script>

<template>
  <span class="relative grid size-4 shrink-0 place-items-center" role="img" :aria-label="label">
    <component
      :is="icon"
      :size="16"
      :stroke-width="1.5"
      :class="state === 'asleep' || state === 'exited' ? 'opacity-45' : ''"
    />
    <span
      v-if="pending"
      class="absolute -inset-1 animate-spin rounded-full border-[1.5px] border-state-pending border-e-transparent motion-reduce:animate-none"
      aria-hidden="true"
    />
    <span
      v-else-if="problem"
      class="absolute -end-0.5 -bottom-0.5 size-2 rounded-full bg-state-error ring-2 ring-chrome"
      aria-hidden="true"
    />
  </span>
</template>
