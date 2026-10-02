<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import type { PromptAnswer, Tab } from '@/ipc/types'
import { useTabLabel } from '@/composables/useTabLabel'
import { useSessions } from '@/stores/sessions'
import { useWorkbench } from '@/stores/workbench'
import ConnectionSteps from './ConnectionSteps.vue'
import PaneNotice from './PaneNotice.vue'
import PromptHostKey from './PromptHostKey.vue'
import PromptInteractive from './PromptInteractive.vue'
import PromptSecret from './PromptSecret.vue'

/**
 * Everything a pane shows instead of, or over, its terminal: asleep, the
 * connection steps, a question from the server, or what went wrong.
 */
const props = defineProps<{ tab: Tab }>()
const sessions = useSessions()
const workbench = useWorkbench()
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
const endedMessage = computed(() =>
  runtime.value.state === 'disconnected'
    ? (runtime.value.message ?? 'Connexion perdue.')
    : `Session terminée${runtime.value.exitCode !== null ? ` (code ${runtime.value.exitCode})` : ''}.`,
)
</script>

<template>
  <div
    v-if="mode === 'ended'"
    class="material-raised absolute inset-x-4 bottom-4 z-10 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px]"
    role="status"
  >
    <span class="min-w-0 flex-1 truncate">{{ endedMessage }}</span>
    <Button size="sm" variant="secondary" @click="wake">
      {{ remote ? 'Reconnecter' : 'Redémarrer' }}
      <Kbd class="ms-0.5 bg-transparent shadow-none">Entrée</Kbd>
    </Button>
  </div>
  <div
    v-else-if="mode"
    class="absolute inset-0 z-10 grid place-items-center bg-surface/85 p-6 backdrop-blur-[6px]"
  >
    <PaneNotice v-if="mode === 'asleep' || mode === 'failed'" :tab="tab" :mode="mode" />
    <section
      v-else
      class="material-raised w-full max-w-[400px] rounded-2xl p-5"
      :aria-label="names.label(tab)"
    >
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
      <ConnectionSteps v-else :state="runtime.state" :address="names.detail(tab)" />
    </section>
  </div>
</template>
