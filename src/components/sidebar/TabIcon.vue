<script setup lang="ts">
import { computed } from 'vue'
import { FileText, FolderOpen, Server, Terminal, Zap } from '@lucide/vue'
import type { Target, TabView } from '@/ipc/types'
import type { Activity } from '@/stores/activity'
import type { TabState } from '@/stores/sessions'

const props = withDefaults(
  defineProps<{ target: Target; view?: TabView; state: TabState; activity?: Activity }>(),
  { activity: 'idle' },
)

const icon = computed(() =>
  props.view?.kind === 'files'
    ? FolderOpen
    : props.view?.kind === 'document'
      ? FileText
      : props.target.kind === 'local'
        ? Terminal
        : props.target.kind === 'host'
          ? Server
          : Zap,
)
const pending = computed(() => ['connecting', 'verifying', 'authenticating'].includes(props.state))
const problem = computed(() => props.state === 'failed' || props.state === 'disconnected')
/** Only a ready session reports what its program is doing. */
const busy = computed(() => props.state === 'ready' && props.activity === 'working')
const waiting = computed(() => props.state === 'ready' && props.activity === 'waiting')
const label = computed(() => {
  if (busy.value) return 'en cours d’exécution'
  if (waiting.value) return 'en attente'
  return {
    asleep: 'en veille',
    connecting: 'connexion en cours',
    verifying: 'vérification du serveur',
    authenticating: 'authentification',
    ready: 'inactif',
    exited: 'terminé',
    failed: 'échec',
    disconnected: 'déconnecté',
  }[props.state]
})
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
    <Transition
      enter-active-class="transition-[opacity,scale] duration-150 ease-[var(--ease-out)]"
      enter-from-class="opacity-0 scale-50"
      leave-active-class="transition-[opacity,scale] duration-150 ease-[var(--ease-out)]"
      leave-to-class="opacity-0 scale-50"
    >
      <svg
        v-if="busy"
        key="busy"
        class="badge absolute -end-1 -bottom-1 size-[9px] rounded-full bg-chrome text-state-live ring-2 ring-chrome"
        viewBox="0 0 9 9"
        aria-hidden="true"
      >
        <rect class="bar" x="1" y="2" width="1.6" height="5" rx="0.8" />
        <rect class="bar" x="3.7" y="2" width="1.6" height="5" rx="0.8" />
        <rect class="bar" x="6.4" y="2" width="1.6" height="5" rx="0.8" />
      </svg>
      <span
        v-else-if="waiting"
        key="waiting"
        class="badge absolute -end-0.5 -bottom-0.5 size-2 rounded-full bg-state-pending ring-2 ring-chrome"
        aria-hidden="true"
      >
        <span class="pulse absolute inset-0 rounded-full bg-state-pending" />
      </span>
    </Transition>
  </span>
</template>

<style scoped>
.bar {
  fill: currentColor;
  transform-box: fill-box;
  transform-origin: center;
  animation: bar 900ms var(--ease-in-out) infinite;
}
.bar:nth-child(2) {
  animation-delay: 150ms;
}
.bar:nth-child(3) {
  animation-delay: 300ms;
}

@keyframes bar {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

.pulse {
  animation: pulse 1800ms var(--ease-out) infinite;
}

@keyframes pulse {
  from {
    opacity: 0.7;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(2.4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar,
  .pulse {
    animation: none;
  }
  .pulse {
    display: none;
  }
}
</style>
