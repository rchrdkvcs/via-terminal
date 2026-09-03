<script setup lang="ts">
import { computed } from 'vue'
import { usePointerDrag } from '@/composables/usePointerDrag'
import { Maximize2, Minus, PanelLeft, Search, Settings, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app'
import { hostPlatform } from '@/lib/platform'

const store = useAppStore()
const pointerDrag = usePointerDrag()
const isMacOS = hostPlatform() === 'macos'

async function windowAction(action: 'minimize' | 'maximize' | 'close') {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const window = getCurrentWindow()
  if (action === 'minimize') await window.minimize()
  else if (action === 'maximize') await window.toggleMaximize()
  else await window.close()
}

async function startDragging() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const window = getCurrentWindow()
  await window.startDragging()
}

function prepareDragging(event: PointerEvent) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
  const startX = event.clientX
  const startY = event.clientY

  pointerDrag.start(event, (moveEvent) => {
    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return
    pointerDrag.stop()
    void startDragging()
  })
}

function toggleMaximize(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('button')) return
  void windowAction('maximize')
}

/**
 * The pill names what the window is showing. An SSH session is best identified
 * by its destination, a local shell by the name of the default terminal.
 */
const title = computed(() => {
  const session = store.activeSession
  if (!session) return 'Via'
  return session.contextTitle || session.detail || session.name
})
</script>

<template>
  <header
    class="grid h-[54px] shrink-0 grid-cols-3 items-center gap-2 px-2"
    :class="isMacOS ? 'ps-20' : ''"
    @pointerdown="prepareDragging"
    @dblclick="toggleMaximize"
  >
    <div class="flex items-center justify-start gap-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="shrink-0 text-muted-foreground active:scale-[0.96]"
            :aria-label="
              store.sidebarPinned ? 'Masquer la barre latérale' : 'Afficher la barre latérale'
            "
            @click="store.sidebarPinned = !store.sidebarPinned"
          >
            <PanelLeft :stroke-width="1.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Barre latérale · Ctrl B</TooltipContent>
      </Tooltip>
      <span class="truncate px-1 text-sm font-semibold tracking-tight">Via</span>
    </div>

    <!--
      Centred pill. It is a button, not a field: it opens the command palette,
      which already owns search over actions, resources and workspaces.
    -->
    <div class="flex min-w-0 justify-center">
      <button
        class="flex h-8 w-full max-w-xl items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        @click="store.paletteOpen = true"
      >
        <span
          v-if="store.activeSession"
          class="size-1.5 shrink-0 rounded-full"
          :class="{
            'bg-state-online': store.activeSession.status === 'connected',
            'bg-state-pending': ['connecting', 'reconnecting'].includes(store.activeSession.status),
            'bg-state-offline': ['failed', 'disconnected'].includes(store.activeSession.status),
            'bg-muted-foreground': ['closed', 'restorable'].includes(store.activeSession.status),
          }"
        />
        <Search v-else :size="14" :stroke-width="1.5" class="shrink-0" />
        <span class="truncate">{{ title }}</span>
        <KbdGroup class="ms-auto hidden shrink-0 sm:inline-flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </button>
    </div>

    <div class="flex shrink-0 items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground active:scale-[0.96]"
            aria-label="Réglages"
            @click="store.route = 'settings'"
          >
            <Settings :stroke-width="1.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Réglages</TooltipContent>
      </Tooltip>

      <template v-if="!isMacOS">
        <span class="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Réduire"
          @click="windowAction('minimize')"
        >
          <Minus :stroke-width="1.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Agrandir ou restaurer"
          @click="windowAction('maximize')"
        >
          <Maximize2 :stroke-width="1.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="hover:bg-destructive hover:text-white"
          aria-label="Fermer"
          @click="windowAction('close')"
        >
          <X :stroke-width="1.5" />
        </Button>
      </template>
    </div>
  </header>
</template>
