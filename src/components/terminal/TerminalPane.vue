<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import {
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Plug,
  Terminal as TerminalIcon,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import DropZone from '@/components/DropZone.vue'
import { terminals } from '@/terminal/registry'
import { useAppStore } from '@/stores/app'
import { registerSidebarDrop } from '@/lib/sidebar-dnd'

const props = defineProps<{ sessionId: string; paneId: string; closable: boolean }>()

const store = useAppStore()
const host = ref<HTMLElement>()
let cleanupDrop: (() => void) | undefined
const surface = ref<HTMLElement>()
const splitHint = ref<'left' | 'right' | 'top' | 'bottom' | null>(null)
const splitDrop = computed(() => {
  const edge = splitHint.value
  if (!edge) return null
  return {
    left: { icon: PanelLeft, label: 'Déposez l’onglet ici pour l’ajouter à gauche' },
    right: { icon: PanelRight, label: 'Déposez l’onglet ici pour l’ajouter à droite' },
    top: { icon: PanelTop, label: 'Déposez l’onglet ici pour l’ajouter en haut' },
    bottom: { icon: PanelBottom, label: 'Déposez l’onglet ici pour l’ajouter en bas' },
  }[edge]
})

const session = computed(() => store.sessionById.get(props.sessionId) ?? null)
const isActive = computed(() => store.activeTab?.activePaneId === props.paneId)
/** A restored pane holds no process until the user asks for one. */
const isPlaceholder = computed(() => session.value?.status === 'restorable')

function mountTerminal() {
  if (!host.value || isPlaceholder.value) return
  terminals.attach(props.sessionId, host.value, undefined, (title) =>
    store.setSessionContext(props.sessionId, title),
  )
  if (isActive.value) terminals.focus(props.sessionId)
}

function targetTabId() {
  return store.tabs.find((tab) => store.paneSessionIds(tab.root).includes(props.sessionId))?.id
}

function splitEdge(input: { clientX: number; clientY: number }) {
  if (!surface.value) return null
  const rect = surface.value.getBoundingClientRect()
  const x = (input.clientX - rect.left) / rect.width
  const y = (input.clientY - rect.top) / rect.height
  if (x < 0.25) return 'left'
  if (x > 0.75) return 'right'
  if (y < 0.25) return 'top'
  if (y > 0.75) return 'bottom'
  return null
}

onMounted(() => {
  mountTerminal()
  if (surface.value)
    cleanupDrop = registerSidebarDrop(surface.value, {
      canDrop: (drag) => drag.type === 'tab' && drag.id !== targetTabId(),
      onMove: (_drag, input) => (splitHint.value = splitEdge(input)),
      onLeave: () => (splitHint.value = null),
      onDrop: (drag, input) => {
        const target = targetTabId()
        const edge = splitEdge(input)
        if (drag.type === 'tab' && target && edge) void store.linkTabs(drag.id, target, edge)
        splitHint.value = null
      },
    })
})

useResizeObserver(host, () => terminals.requestFit(props.sessionId))

// The registry keeps the renderer alive; only this view of it goes away.
onBeforeUnmount(() => {
  cleanupDrop?.()
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
    ref="surface"
    class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition-shadow duration-150"
    :aria-label="session?.name ?? 'Terminal'"
    @mousedown="store.selectPane(paneId)"
  >
    <DropZone
      v-if="splitHint && splitDrop"
      class="absolute z-20 m-2 border-ring bg-card/90 text-foreground shadow-sm"
      :class="{
        'inset-y-0 left-0 w-[30%]': splitHint === 'left',
        'inset-y-0 right-0 w-[30%]': splitHint === 'right',
        'inset-x-0 top-0 h-[30%]': splitHint === 'top',
        'inset-x-0 bottom-0 h-[30%]': splitHint === 'bottom',
      }"
      :icon="splitDrop.icon"
      :label="splitDrop.label"
      active
    />
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
