<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@lucide/vue'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import LockScreen from '@/components/LockScreen.vue'
import PaneLayout from '@/components/workspace/PaneLayout.vue'
import SplitGroupLayout from '@/components/workspace/SplitGroupLayout.vue'
import SettingsPage from '@/components/settings/SettingsPage.vue'
import TargetDialog from '@/components/TargetDialog.vue'
import TerminalSearch from '@/components/TerminalSearch.vue'
import TopBar from '@/components/workspace/TopBar.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useAppearance } from '@/composables/useAppearance'
import { useShortcuts } from '@/composables/useShortcuts'
import { isNative } from '@/ipc/client'
import { terminals } from '@/terminal/registry'
import { useAppStore } from '@/stores/app'
import { toast } from 'vue-sonner'
import 'vue-sonner/style.css'

const store = useAppStore()
useAppearance()
useShortcuts()

const targetDialog = ref<'resource' | null>(null)
let unbind: (() => void) | undefined

const closingTab = computed(
  () => store.tabs.find((tab) => tab.id === store.pendingTabClose) ?? null,
)
const deletingWorkspace = computed(
  () => store.workspaces.find((workspace) => workspace.id === store.pendingWorkspaceDelete) ?? null,
)

const sidebarWidth = computed(() =>
  Math.min(
    Math.max(240, window.innerWidth * 0.4),
    Math.max(180, store.preferences.sidebarWidth || 256),
  ),
)
const resizingSidebar = ref(false)

function startSidebarResize(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  clearPeekTimers()
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  resizingSidebar.value = true
  const origin = event.clientX
  const opened = store.sidebarPinned || store.sidebarPeek
  const originWidth = opened ? sidebarWidth.value : 0

  const move = (moveEvent: PointerEvent) => {
    const next = originWidth + (moveEvent.clientX - origin)
    if (next < 120) {
      store.sidebarPinned = false
      store.sidebarPeek = false
      return
    }
    store.updatePreferences({ sidebarWidth: Math.min(480, Math.max(180, next)) })
    if (!store.sidebarPinned) {
      store.sidebarPinned = true
      store.sidebarPeek = false
    }
  }
  const stop = () => {
    resizingSidebar.value = false
    handle.releasePointerCapture(event.pointerId)
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', stop)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', stop)
}

/**
 * Compact-mode peek, matching Zen: the pointer must rest on the window edge
 * before the overlay appears, and it stays up for a beat after leaving so a
 * menu or a slightly sloppy pointer does not slam it shut.
 */
let revealTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

function clearPeekTimers() {
  if (revealTimer) clearTimeout(revealTimer)
  if (hideTimer) clearTimeout(hideTimer)
  revealTimer = undefined
  hideTimer = undefined
}

function scheduleReveal() {
  if (store.sidebarPinned || store.route !== 'workspace') return
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }
  if (store.sidebarPeek || revealTimer) return
  revealTimer = setTimeout(() => {
    revealTimer = undefined
    store.sidebarPeek = true
  }, store.preferences.sidebarRevealDelay)
}

function scheduleHide() {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = undefined
  }
  if (!store.sidebarPeek || hideTimer) return
  hideTimer = setTimeout(() => {
    hideTimer = undefined
    if (document.querySelector('[data-slot="dropdown-menu-content"]')) {
      scheduleHide()
      return
    }
    store.sidebarPeek = false
  }, store.preferences.sidebarHideDelay)
}

// Notices surface as toasts so they never displace the terminal below them.
watch(
  () => store.notices.length,
  () => {
    const notice = store.notices[store.notices.length - 1]
    if (!notice) return
    const show =
      notice.kind === 'error' ? toast.error : notice.kind === 'success' ? toast.success : toast
    show(notice.message, {
      action: notice.action
        ? { label: notice.action.label, onClick: notice.action.run }
        : undefined,
    })
    store.dismissNotice(notice.id)
  },
)

// Pinning the sidebar again ends any peek, so the two states never overlap.
watch(
  () => store.sidebarPinned,
  () => {
    clearPeekTimers()
    store.sidebarPeek = false
  },
)

onMounted(async () => {
  unbind = store.bindNativeEvents()
  await store.initialize()
  if (isNative()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const currentWindow = getCurrentWindow()
    unlistenClose = await currentWindow.onCloseRequested(async (event) => {
      if (closingWindow) return
      event.preventDefault()
      closingWindow = true
      await store.persistWindowState()
      terminals.releaseAll()
      await currentWindow.destroy()
    })
  }
})

onBeforeUnmount(() => {
  clearPeekTimers()
  unbind?.()
  unlistenClose?.()
})

let unlistenClose: (() => void) | undefined
let closingWindow = false
</script>

<template>
  <SidebarProvider
    :open="store.sidebarPinned"
    class="flex h-full !min-h-0 flex-col overflow-hidden bg-background"
    @update:open="store.sidebarPinned = $event"
  >
    <TopBar />

    <div class="relative flex min-h-0 flex-1 gap-2 px-2 pb-2">
      <!-- Pinned: the panel sits in the flow and the terminal gives up the space. -->
      <Transition
        enter-active-class="transition-[width] duration-200 ease-out"
        enter-from-class="!w-0"
        leave-active-class="transition-[width] duration-200 ease-out"
        leave-to-class="!w-0"
      >
        <div
          v-if="store.sidebarPinned && store.route === 'workspace'"
          class="relative h-full shrink-0 overflow-hidden"
          :class="resizingSidebar ? '' : 'transition-[width] duration-200 ease-out'"
          :style="{ width: `${sidebarWidth}px` }"
        >
          <AppSidebar @add-resource="targetDialog = 'resource'" />
          <div
            class="group absolute inset-y-0 end-0 z-20 w-2 cursor-ew-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Largeur de la barre latérale"
            :aria-valuenow="Math.round(sidebarWidth)"
            aria-valuemin="180"
            aria-valuemax="480"
            tabindex="0"
            @pointerdown="startSidebarResize"
            @dblclick="store.updatePreferences({ sidebarWidth: 256 })"
          >
            <span
              class="absolute top-1/2 end-0.5 h-10 w-0.5 -translate-y-1/2 rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
        </div>
      </Transition>

      <!--
        Compact: a hit strip on the window edge. Resting there reveals a floating
        overlay so xterm is never refit. Leaving starts the hide delay. The
        handle on the strip still resizes — and dragging it open pins the panel.
      -->
      <template v-if="!store.sidebarPinned && store.route === 'workspace'">
        <div
          class="absolute inset-y-0 start-0 z-40"
          :style="{ width: store.sidebarPeek ? `${sidebarWidth}px` : '20px' }"
          :aria-hidden="store.sidebarPeek ? undefined : 'true'"
          @pointerenter="scheduleReveal"
          @pointerleave="scheduleHide"
        >
          <Transition
            enter-active-class="transition-[translate,opacity] duration-100 ease-out"
            enter-from-class="-translate-x-full opacity-0"
            leave-active-class="transition-[translate,opacity] duration-100 ease-out"
            leave-to-class="-translate-x-full opacity-0"
          >
            <div
              v-if="store.sidebarPeek"
              class="h-full overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl"
              :style="{ width: `${sidebarWidth}px` }"
            >
              <AppSidebar @add-resource="targetDialog = 'resource'" />
            </div>
          </Transition>
          <div
            class="group absolute inset-y-0 end-0 z-20 w-2 cursor-ew-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Largeur de la barre latérale"
            :aria-valuenow="Math.round(sidebarWidth)"
            aria-valuemin="180"
            aria-valuemax="480"
            tabindex="0"
            @pointerdown="startSidebarResize"
            @dblclick="store.updatePreferences({ sidebarWidth: 256 })"
            @pointerenter="scheduleReveal"
          >
            <span
              class="absolute top-1/2 end-0.5 h-10 w-0.5 -translate-y-1/2 rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
        </div>
      </template>

      <main
        class="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl"
        :class="
          store.route === 'settings' ||
          (store.activeSession &&
            !['closed', 'failed', 'restorable'].includes(store.activeSession.status))
            ? 'border border-border/50 bg-card'
            : ''
        "
      >
        <SettingsPage v-if="store.route === 'settings'" @add-resource="targetDialog = 'resource'" />

        <template v-else>
          <TerminalSearch />

          <div v-if="store.activeTab" class="flex min-h-0 flex-1 overflow-hidden">
            <SplitGroupLayout v-if="store.activeSplitGroup" :node="store.activeSplitGroup.root" />
            <div
              v-else-if="
                store.activeSession &&
                ['closed', 'failed', 'restorable'].includes(store.activeSession.status)
              "
              class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4"
            >
              <p class="text-sm text-muted-foreground">
                {{ store.activeSession.message || 'Terminal arrêté.' }}
              </p>
              <Button @click="store.startStoppedTab(store.activeTab.id)">
                {{ store.activeSession.kind === 'ssh' ? 'Reconnecter' : 'Démarrer' }}
              </Button>
            </div>
            <PaneLayout
              v-else
              :key="store.activeTab.id"
              :node="store.activeTab.root"
              :closable="store.activeTab.root.kind === 'split'"
            />
          </div>

          <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-8">
            <span
              class="grid size-14 place-items-center rounded-xl border bg-card text-muted-foreground"
            >
              <Terminal :size="24" :stroke-width="1.5" />
            </span>
            <div class="max-w-sm space-y-2 text-center">
              <h1 class="text-xl font-semibold tracking-tight">Prêt quand vous l’êtes.</h1>
              <p class="text-sm leading-relaxed text-muted-foreground">
                Ouvrez un terminal local ou reprenez une ressource depuis la barre latérale.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <Button class="gap-2 active:scale-[0.96]" @click="store.createTerminal()">
                <Terminal :size="15" :stroke-width="1.5" />
                Nouveau terminal
              </Button>
              <kbd class="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                Ctrl T
              </kbd>
            </div>
            <p v-if="!isNative()" class="text-xs text-muted-foreground">
              Aperçu navigateur : lancez <code class="font-mono">pnpm tauri dev</code> pour des
              terminaux réels.
            </p>
          </div>
        </template>
      </main>
    </div>

    <CommandPalette />
    <TargetDialog :mode="targetDialog" @close="targetDialog = null" />
    <LockScreen />
    <Toaster position="bottom-right" :duration="6000" close-button />

    <Dialog
      :open="Boolean(deletingWorkspace)"
      @update:open="store.pendingWorkspaceDelete = $event ? store.pendingWorkspaceDelete : null"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {{ deletingWorkspace?.name }} » ?</DialogTitle>
          <DialogDescription>
            L’espace, ses dossiers et ses ressources seront retirés. Les sessions ouvertes de cet
            espace seront arrêtées.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="store.pendingWorkspaceDelete = null">Annuler</Button>
          <Button
            variant="destructive"
            class="active:scale-[0.96]"
            @click="deletingWorkspace && store.deleteWorkspace(deletingWorkspace.id)"
          >
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="Boolean(closingTab)" @update:open="store.pendingTabClose = null">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fermer « {{ closingTab?.name }} » ?</DialogTitle>
          <DialogDescription>
            Cet onglet contient des sessions actives. Les processus correspondants seront arrêtés.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="store.pendingTabClose = null">Annuler</Button>
          <Button
            variant="destructive"
            class="active:scale-[0.96]"
            @click="closingTab && store.closeTab(closingTab.id, { force: true })"
          >
            Fermer l’onglet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SidebarProvider>
</template>
