<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { PromptAnswer, Tab } from '@/ipc/types'
import { useTabLabel } from '@/composables/useTabLabel'
import { useSessions, type TabState } from '@/stores/sessions'
import PromptHostKey from './PromptHostKey.vue'
import PromptInteractive from './PromptInteractive.vue'
import PromptSecret from './PromptSecret.vue'
import SessionNotice from './SessionNotice.vue'

/** How long a remote tab keeps showing its success before revealing the terminal. */
const READY_HOLD_MS = 1100
const PENDING: readonly TabState[] = ['connecting', 'verifying', 'authenticating']

const props = defineProps<{ tab: Tab }>()
const sessions = useSessions()
const names = useTabLabel()
const motion = usePreferredReducedMotion()

const runtime = computed(() => sessions.runtime(props.tab.id))
const remote = computed(() => props.tab.target.kind !== 'local')

const celebrating = ref(false)
let celebration: ReturnType<typeof setTimeout> | undefined
watch(
  () => runtime.value.state,
  (state, previous) => {
    clearTimeout(celebration)
    celebrating.value =
      state === 'ready' && remote.value && PENDING.includes(previous) && motion.value !== 'reduce'
    if (celebrating.value)
      celebration = setTimeout(() => (celebrating.value = false), READY_HOLD_MS)
  },
)
onBeforeUnmount(() => clearTimeout(celebration))

const mode = computed(() => {
  const { state, prompt } = runtime.value
  if (prompt) return 'prompt'
  if (state === 'ready') return celebrating.value ? 'notice' : null
  if (PENDING.includes(state)) return remote.value ? 'notice' : null
  return 'notice'
})

const answer = (reply: PromptAnswer) => void sessions.answer(props.tab.id, reply)
</script>

<template>
  <Transition
    leave-active-class="transition-opacity duration-300 motion-reduce:transition-none"
    leave-to-class="opacity-0"
  >
    <div
      v-if="mode"
      class="absolute inset-0 z-10 grid place-items-center bg-surface/85 p-6 backdrop-blur-[6px]"
      :class="{ 'pointer-events-none': celebrating }"
    >
      <section
        v-if="mode === 'prompt' && runtime.prompt"
        class="material-raised w-full max-w-[400px] rounded-2xl p-5"
        :aria-label="names.label(tab)"
      >
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
      </section>
      <SessionNotice v-else :tab="tab" />
    </div>
  </Transition>
</template>
