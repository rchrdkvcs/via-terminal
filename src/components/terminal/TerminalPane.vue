<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Plug, RotateCw, Terminal as TerminalIcon, X } from '@lucide/vue'
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
const needsReconnect = computed(() => session.value?.status === 'failed')

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
    class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-terminal-background transition-[box-shadow] duration-150"
    :class="isActive ? 'shadow-[inset_0_0_0_1px_var(--ring)]' : ''"
    :aria-label="session?.name ?? 'Terminal'"
    @mousedown="store.selectPane(paneId)"
  >
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b bg-card/60 pe-1 ps-3 text-xs"
      :class="isActive ? 'text-foreground' : 'text-muted-foreground'"
    >
      <span
        class="size-1.5 shrink-0 rounded-full"
        :class="{
          'bg-success': session?.status === 'connected',
          'bg-warning': session?.status === 'reconnecting' || session?.status === 'connecting',
          'bg-destructive': session?.status === 'failed' || session?.status === 'disconnected',
          'bg-muted-foreground': session?.status === 'restorable' || session?.status === 'closed',
        }"
        aria-hidden="true"
      />
      <span class="truncate font-medium">{{ session?.name ?? 'Session' }}</span>
      <span class="truncate text-muted-foreground">{{ session?.detail }}</span>
      <span v-if="session?.message" class="truncate text-warning">{{ session.message }}</span>

      <div class="ms-auto flex items-center gap-1">
        <Button
          v-if="needsReconnect"
          variant="ghost"
          size="xs"
          class="gap-1.5"
          @click="store.reconnectSession(sessionId)"
        >
          <RotateCw :size="13" :stroke-width="1.5" />
          Reconnecter
        </Button>
        <Button
          v-if="closable"
          variant="ghost"
          size="icon-xs"
          :aria-label="`Fermer le panneau ${session?.name ?? ''}`"
          class="active:scale-[0.96]"
          @click.stop="store.closePane(paneId)"
        >
          <X :size="13" :stroke-width="1.5" />
        </Button>
      </div>
    </header>

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
