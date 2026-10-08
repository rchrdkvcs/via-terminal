<script setup lang="ts">
import { computed } from 'vue'
import { SessionLink } from '@/components/animations'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import type { Tab } from '@/ipc/types'
import { sceneTone, sessionScene, type SessionScene } from '@/domain/session-scene'
import { useClosing } from '@/composables/useClosing'
import { useTabLabel } from '@/composables/useTabLabel'
import { useSessions } from '@/stores/sessions'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'

const props = defineProps<{ tab: Tab }>()
const sessions = useSessions()
const ui = useUi()
const workbench = useWorkbench()
const closing = useClosing()
const names = useTabLabel()

const runtime = computed(() => sessions.runtime(props.tab.id))
const remote = computed(() => props.tab.target.kind !== 'local')
const scene = computed(() => sessionScene(runtime.value.state, runtime.value.reason))
const tone = computed(() => sceneTone(scene.value))
const failure = computed(() =>
  (['unreachable', 'refused', 'hostKey', 'failed'] as SessionScene[]).includes(scene.value),
)
const pending = computed(() =>
  (['connecting', 'verifying', 'authenticating', 'ready'] as SessionScene[]).includes(scene.value),
)

const title = computed(() => {
  switch (scene.value) {
    case 'asleep':
      return names.label(props.tab)
    case 'connecting':
      return `Connexion à ${names.detail(props.tab)}`
    case 'verifying':
      return 'Vérification du serveur'
    case 'authenticating':
      return 'Authentification'
    case 'ready':
      return 'Connecté'
    case 'refused':
      return 'Authentification refusée'
    case 'hostKey':
      return 'Clé du serveur refusée'
    case 'unreachable':
      return 'Connexion impossible'
    case 'failed':
      return remote.value ? 'Connexion impossible' : 'Le terminal n’a pas démarré'
    case 'disconnected':
      return 'Connexion perdue'
    case 'exited':
      return runtime.value.reason === 'cancelled' ? 'Connexion annulée' : 'Session terminée'
  }
  return ''
})
const message = computed(() => {
  const { exitCode, message } = runtime.value
  if (scene.value === 'asleep') return names.detail(props.tab)
  if (pending.value) return names.label(props.tab)
  if (scene.value === 'exited') return exitCode !== null ? `Code de sortie ${exitCode}.` : null
  return message
})
const action = computed(() => {
  if (scene.value === 'asleep') return remote.value ? 'Se connecter' : 'Démarrer'
  if (failure.value) return 'Réessayer'
  if (scene.value === 'exited' && !remote.value) return 'Redémarrer'
  return 'Reconnecter'
})

const wake = () => workbench.reconnect(props.tab.id)
const editHost = () =>
  props.tab.target.kind === 'host' && ui.showVault('hosts', props.tab.target.hostId)
</script>

<template>
  <div
    class="flex w-full max-w-[420px] flex-col items-center gap-4 text-center"
    :role="tone === 'neutral' ? 'status' : 'alert'"
    :aria-live="pending ? 'polite' : undefined"
  >
    <div class="grid h-[120px] w-full place-items-center">
      <SessionLink :scene="scene" :tone="tone" :local="!remote" />
    </div>
    <Transition
      mode="out-in"
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      leave-active-class="transition duration-100 motion-reduce:transition-none"
      enter-from-class="translate-y-1 opacity-0"
      leave-to-class="opacity-0"
    >
      <div :key="scene" class="space-y-1">
        <h2 class="text-[15px] font-semibold tracking-[-0.01em]">{{ title }}</h2>
        <p v-if="message" class="max-w-[340px] text-[13px] text-pretty text-ink-muted">
          {{ message }}
        </p>
      </div>
    </Transition>
    <div v-if="!pending" class="flex items-center gap-2">
      <Button @click="wake">
        {{ action }}
        <Kbd class="ms-1 bg-transparent text-current opacity-60 shadow-none">Entrée</Kbd>
      </Button>
      <Button v-if="failure && tab.target.kind === 'host'" variant="secondary" @click="editHost">
        Modifier l’hôte
      </Button>
      <Button v-if="failure" variant="ghost" @click="closing.closeTab(tab.id)">
        Fermer l’onglet
      </Button>
    </div>
  </div>
</template>
