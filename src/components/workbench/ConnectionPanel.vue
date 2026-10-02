<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import type { PromptAnswer, Tab } from '@/ipc/types'
import { useTabLabel } from '@/composables/useTabLabel'
import { useSessions } from '@/stores/sessions'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import { useTabClosing } from '@/composables/useTabClosing'
import ConnectionSteps from './ConnectionSteps.vue'
import PromptHostKey from './PromptHostKey.vue'
import PromptInteractive from './PromptInteractive.vue'
import PromptSecret from './PromptSecret.vue'

/**
 * Everything a pane shows instead of, or over, its terminal: asleep, the
 * connection steps, a question from the server, or what went wrong.
 */
const props = defineProps<{ tab: Tab }>()
const sessions = useSessions()
const ui = useUi()
const workbench = useWorkbench()
const closing = useTabClosing()
const names = useTabLabel()

const runtime = computed(() => sessions.runtime(props.tab.id))
const remote = computed(() => props.tab.target.kind !== 'local')
const mode = computed(() => {
  const { state, prompt } = runtime.value
  if (prompt) return 'prompt'
  if (state === 'ready') return null
  if (state === 'connecting' || state === 'verifying' || state === 'authenticating') {
    return remote.value ? 'progress' : null
  }
  if (state === 'disconnected' || state === 'exited') return 'ended'
  return state
})

const answer = (reply: PromptAnswer) => void sessions.answer(props.tab.id, reply)
const wake = () => workbench.reconnect(props.tab.id)
const editHost = () =>
  props.tab.target.kind === 'host' && ui.showVault('hosts', props.tab.target.hostId)
const endedMessage = computed(() =>
  runtime.value.state === 'disconnected'
    ? (runtime.value.message ?? 'Connexion perdue.')
    : `Session terminée${runtime.value.exitCode !== null ? ` (code ${runtime.value.exitCode})` : ''}.`,
)
</script>

<template>
  <div
    v-if="mode === 'ended'"
    class="absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 rounded-lg bg-popover/95 px-3 py-2 text-[13px] shadow-surface backdrop-blur"
    role="status"
  >
    <span class="min-w-0 flex-1 truncate">{{ endedMessage }}</span>
    <span class="text-muted-foreground">Appuyez sur <Kbd>Entrée</Kbd> ou</span>
    <Button size="sm" variant="secondary" @click="wake">{{
      remote ? 'Reconnecter' : 'Redémarrer'
    }}</Button>
  </div>
  <div
    v-else-if="mode"
    class="absolute inset-0 z-10 grid place-items-center bg-surface/90 p-6 backdrop-blur-sm"
  >
    <section class="w-full max-w-sm" :aria-label="names.label(tab)">
      <template v-if="mode === 'prompt' && runtime.prompt">
        <PromptHostKey
          v-if="runtime.prompt.prompt.kind === 'hostKey'"
          :key="runtime.prompt.id"
          :prompt="runtime.prompt.prompt"
          @answer="answer"
        />
        <PromptInteractive
          v-else-if="runtime.prompt.prompt.kind === 'keyboardInteractive'"
          :key="runtime.prompt.id"
          :prompt="runtime.prompt.prompt"
          @answer="answer"
        />
        <PromptSecret
          v-else
          :key="runtime.prompt.id"
          :prompt="runtime.prompt.prompt"
          @answer="answer"
        />
      </template>
      <ConnectionSteps
        v-else-if="mode === 'progress'"
        :state="runtime.state"
        :address="names.detail(tab)"
      />
      <div v-else-if="mode === 'asleep'" class="flex flex-col items-start gap-3">
        <h2 class="text-sm font-semibold">{{ names.label(tab) }}</h2>
        <p class="text-[13px] text-muted-foreground">{{ names.detail(tab) }}</p>
        <Button size="sm" @click="wake">{{ remote ? 'Se connecter' : 'Démarrer' }}</Button>
      </div>
      <div v-else-if="mode === 'failed'" class="flex flex-col items-start gap-3" role="alert">
        <h2 class="text-sm font-semibold">
          {{ remote ? 'Connexion impossible' : 'Le terminal n’a pas démarré' }}
        </h2>
        <p class="text-[13px] text-muted-foreground">{{ runtime.message }}</p>
        <div class="flex gap-2">
          <Button size="sm" @click="wake">Réessayer</Button>
          <Button v-if="tab.target.kind === 'host'" size="sm" variant="ghost" @click="editHost"
            >Modifier l’hôte</Button
          >
          <Button size="sm" variant="ghost" @click="closing.close(tab.id)">Fermer l’onglet</Button>
        </div>
      </div>
    </section>
  </div>
</template>
