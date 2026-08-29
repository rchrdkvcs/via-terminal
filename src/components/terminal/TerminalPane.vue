<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Plug, Terminal as TerminalIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { terminals } from '@/terminal/registry'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ sessionId: string; paneId: string; closable: boolean }>()

const store = useAppStore()
const host = ref<HTMLElement>()
let observer: ResizeObserver | undefined

const session = computed(() => store.sessionById.get(props.sessionId) ?? null)
const isActive = computed(() => store.activeTab?.activePaneId === props.paneId)
/** A restored pane holds no process until the user asks for one. */
const isPlaceholder = computed(() => session.value?.status === 'restorable')

function mountTerminal() {
  if (!host.value || isPlaceholder.value) return
  terminals.attach(props.sessionId, host.value)
  if (isActive.value) terminals.focus(props.sessionId)
}

onMounted(() => {
  mountTerminal()
  if (host.value) {
    observer = new ResizeObserver(() => terminals.requestFit(props.sessionId))
    observer.observe(host.value)
  }
})

// The registry keeps the renderer alive; only this view of it goes away.
onBeforeUnmount(() => {
  observer?.disconnect()
  terminals.detach(props.sessionId)
})

watch(() => props.sessionId, mountTerminal)
watch(isPlaceholder, (placeholder) => {
  if (!placeholder) mountTerminal()
})
watch(isActive, (active) => {
  if (active && !isPlaceholder.value) terminals.focus(props.sessionId)
})
</script>

<template>
  <section
    class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-card transition-[box-shadow] duration-150"
    :class="isActive ? 'shadow-[inset_0_0_0_1px_var(--ring)]' : ''"
    :aria-label="session?.name ?? 'Terminal'"
    @mousedown="store.selectPane(paneId)"
  >
    <!-- The registry appends its own element here; Vue never owns the xterm DOM. -->
    <div v-show="!isPlaceholder" ref="host" class="terminal-surface min-h-0 flex-1" />

    <div
      v-if="isPlaceholder"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <span class="grid size-11 place-items-center rounded-xl bg-accent text-muted-foreground">
        <TerminalIcon :size="20" :stroke-width="1.5" />
      </span>
      <div class="space-y-1">
        <p class="text-sm font-medium">{{ session?.name }}</p>
        <p class="max-w-xs text-xs text-muted-foreground">
          Disposition restaurée. Rien n’a été lancé ni reconnecté automatiquement.
        </p>
      </div>
      <Button
        size="sm"
        class="gap-2 active:scale-[0.96]"
        @click="store.activateRestorableSession(sessionId)"
      >
        <Plug :size="14" :stroke-width="1.5" />
        Démarrer la session
      </Button>
    </div>
  </section>
</template>
