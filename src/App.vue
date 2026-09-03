<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { Terminal } from '@lucide/vue'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import PaneLayout from '@/components/workspace/PaneLayout.vue'
import SplitGroupLayout from '@/components/workspace/SplitGroupLayout.vue'
import SettingsPage from '@/components/settings/SettingsPage.vue'
import TargetDialog from '@/components/TargetDialog.vue'
import TerminalSearch from '@/components/TerminalSearch.vue'
import TopBar from '@/components/workspace/TopBar.vue'
import { Button } from '@/components/ui/button'
import { DotPattern } from '@/components/ui/dot-pattern'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useAppearance } from '@/composables/useAppearance'
import { useShortcuts } from '@/composables/useShortcuts'
import { usePointerDrag } from '@/composables/usePointerDrag'
import { isNative } from '@/ipc/client'
import { terminals } from '@/terminal/registry'
import { useAppStore } from '@/stores/app'
import { toast } from 'vue-sonner'
import 'vue-sonner/style.css'

const store = useAppStore()
useAppearance()
useShortcuts()

const targetDialog = ref<'resource' | null>(null)
const { width: windowWidth } = useWindowSize()
const sidebarDrag = usePointerDrag()
let unbind: (() => void) | undefined

const closingTab = computed(
  () => store.tabs.find((tab) => tab.id === store.pendingTabClose) ?? null,
)
const deletingWorkspace = computed(
  () => store.workspaces.find((workspace) => workspace.id === store.pendingWorkspaceDelete) ?? null,
)
const nodeDeleteDescription = computed(() => {
  const impact = store.pendingNodeDelete
  if (!impact) return ''
  const details: string[] = []
  if (impact.descendantCount)
    details.push(
      `${impact.descendantCount} ${impact.descendantCount === 1 ? 'élément contenu sera également supprimé' : 'éléments contenus seront également supprimés'}`,
    )
  if (impact.resourceCount)
    details.push(
      `${impact.resourceCount} ${impact.resourceCount === 1 ? 'ressource SSH sera retirée' : 'ressources SSH seront retirées'}`,
    )
  if (impact.activeTabCount)
    details.push(
      `${impact.activeTabCount} ${impact.activeTabCount === 1 ? 'onglet actif sera fermé' : 'onglets actifs seront fermés'}`,
    )
  return `${details.join(' ; ')}.`
})

const sidebarWidth = computed(() =>
  Math.min(
    Math.max(240, windowWidth.value * 0.4),
    Math.max(180, store.preferences.sidebarWidth || 256),
  ),
)
const resizingSidebar = sidebarDrag.active

function startSidebarResize(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  clearPeekTimers()
  const origin = event.clientX
  const opened = store.sidebarPinned || store.sidebarPeek
  const originWidth = opened ? sidebarWidth.value : 0

  sidebarDrag.start(event, (moveEvent) => {
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
  })
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
    class="relative flex h-full !min-h-0 flex-col overflow-hidden bg-background"
    @update:open="store.sidebarPinned = $event"
  >
    <DotPattern
      class="absolute inset-0 text-foreground/[0.09] [mask-image:radial-gradient(ellipse_80%_70%_at_60%_48%,black,transparent)] dark:text-foreground/[0.075]"
    />

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
              class="sidebar-resize-line absolute inset-y-[15%] end-0.5 w-px rounded-full opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
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
          data-sidebar-peek-zone
          class="sidebar-peek-zone absolute inset-y-0 start-0 z-40"
          :style="{ width: store.sidebarPeek ? `${sidebarWidth + 4}px` : '32px' }"
          :aria-hidden="store.sidebarPeek ? undefined : 'true'"
          @pointerenter="scheduleReveal"
          @pointerleave="scheduleHide"
        >
          <Transition
            enter-active-class="transition-transform duration-250 [transition-timing-function:var(--ease-zen-compact)] motion-reduce:transition-none"
            enter-from-class="-translate-x-[calc(100%+4px)] motion-reduce:translate-x-0"
            leave-active-class="transition-transform duration-150 ease-in-out motion-reduce:transition-none"
            leave-to-class="-translate-x-[calc(100%+4px)] motion-reduce:translate-x-0"
          >
            <div
              v-show="store.sidebarPeek"
              data-sidebar-peek-panel
              class="floating-material floating-material--large absolute -top-1 bottom-1 start-1 overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl"
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
              class="sidebar-resize-line absolute inset-y-[15%] end-0.5 w-px rounded-full opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            />
          </div>
        </div>
      </template>

      <main
        class="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl"
        :class="store.route === 'settings' ? 'border border-border/50 bg-card' : ''"
      >
        <SettingsPage v-if="store.route === 'settings'" @add-resource="targetDialog = 'resource'" />

        <template v-else>
          <TerminalSearch />

          <div v-if="store.activeTab" class="flex min-h-0 flex-1 overflow-hidden">
            <SplitGroupLayout v-if="store.activeSplitGroup" :node="store.activeSplitGroup.root" />
            <Empty
              v-else-if="
                store.activeSession &&
                ['closed', 'failed', 'restorable'].includes(store.activeSession.status)
              "
              class="border-border/50 bg-card"
            >
              <EmptyHeader>
                <EmptyTitle>Terminal arrêté</EmptyTitle>
                <EmptyDescription>
                  {{ store.activeSession.message || 'Cette session n’est plus active.' }}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button @click="store.startStoppedTab(store.activeTab.id)">
                  {{ store.activeSession.kind === 'ssh' ? 'Reconnecter' : 'Démarrer' }}
                </Button>
              </EmptyContent>
            </Empty>
            <PaneLayout
              v-else
              :key="store.activeTab.id"
              :node="store.activeTab.root"
              :closable="store.activeTab.root.kind === 'split'"
            />
          </div>

          <Empty v-else class="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Terminal :size="24" :stroke-width="1.5" />
              </EmptyMedia>
              <EmptyTitle>Prêt quand vous l’êtes.</EmptyTitle>
              <EmptyDescription>
                Ouvrez un terminal local ou reprenez une ressource depuis la barre latérale.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div class="flex items-center gap-3">
                <Button class="gap-2 active:scale-[0.96]" @click="store.createTerminal()">
                  <Terminal :size="15" :stroke-width="1.5" />
                  Nouveau terminal
                </Button>
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>T</Kbd>
                </KbdGroup>
              </div>
              <EmptyDescription v-if="!isNative()">
                Aperçu navigateur : lancez <code class="font-mono">pnpm tauri dev</code> pour des
                terminaux réels.
              </EmptyDescription>
            </EmptyContent>
          </Empty>
        </template>
      </main>
    </div>

    <CommandPalette />
    <TargetDialog :mode="targetDialog" @close="targetDialog = null" />
    <Toaster position="bottom-right" :duration="6000" close-button />

    <AlertDialog
      :open="Boolean(deletingWorkspace)"
      @update:open="store.pendingWorkspaceDelete = $event ? store.pendingWorkspaceDelete : null"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {{ deletingWorkspace?.name }} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            L’espace, ses dossiers et ses ressources seront retirés. Les sessions ouvertes de cet
            espace seront arrêtées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="store.pendingWorkspaceDelete = null"
            >Annuler</AlertDialogCancel
          >
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            @click="deletingWorkspace && store.deleteWorkspace(deletingWorkspace.id)"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      :open="Boolean(store.pendingNodeDelete)"
      @update:open="store.pendingNodeDelete = $event ? store.pendingNodeDelete : null"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {{ store.pendingNodeDelete?.label }} » ?</AlertDialogTitle>
          <AlertDialogDescription>{{ nodeDeleteDescription }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="store.pendingNodeDelete = null">Annuler</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            @click="store.confirmNodeDelete"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="Boolean(closingTab)" @update:open="store.pendingTabClose = null">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fermer « {{ closingTab?.name }} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cet onglet contient des sessions actives. Les processus correspondants seront arrêtés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="store.pendingTabClose = null">Annuler</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            @click="closingTab && store.closeTab(closingTab.id, { force: true })"
          >
            Fermer l’onglet
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SidebarProvider>
</template>

<style scoped>
.sidebar-resize-line {
  background: linear-gradient(to bottom, transparent, var(--color-border), transparent);
}
</style>
