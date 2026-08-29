<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@lucide/vue'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import LockScreen from '@/components/LockScreen.vue'
import PaneLayout from '@/components/workspace/PaneLayout.vue'
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

const targetDialog = ref<'profile' | 'resource' | null>(null)
let unbind: (() => void) | undefined

const closingTab = computed(
  () => store.tabs.find((tab) => tab.id === store.pendingTabClose) ?? null,
)

/**
 * The 8 px strip is the only affordance for a hidden sidebar. The pointer has
 * to rest on it, so crossing the window edge on the way somewhere else does not
 * flash the panel open.
 */
function revealSidebar() {
  store.sidebarPeek = true
}

function hideSidebar() {
  store.sidebarPeek = false
}

// Notices surface as toasts so they never displace the terminal below them.
watch(
  () => store.notices.length,
  () => {
    const notice = store.notices[store.notices.length - 1]
    if (!notice) return
    const show =
      notice.kind === 'error' ? toast.error : notice.kind === 'success' ? toast.success : toast
    show(notice.message)
    store.dismissNotice(notice.id)
  },
)

// Pinning the sidebar again ends any peek, so the two states never overlap.
watch(
  () => store.sidebarPinned,
  () => {
    store.sidebarPeek = false
  },
)

onMounted(async () => {
  unbind = store.bindNativeEvents()
  await store.initialize()
})

onBeforeUnmount(() => {
  unbind?.()
})

// Closing the window detaches its views; the sessions stay owned by Rust.
window.addEventListener('beforeunload', () => {
  void store.persistWindowState()
  terminals.releaseAll()
})
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
          class="h-full w-64 shrink-0 overflow-hidden"
        >
          <AppSidebar
            @add-profile="targetDialog = 'profile'"
            @add-resource="targetDialog = 'resource'"
          />
        </div>
      </Transition>

      <!--
      Unpinned: an 8 px hover strip plus a floating panel. The panel overlays the
      terminal rather than pushing it, so peeking never reflows xterm.
    -->
      <template v-if="!store.sidebarPinned && store.route === 'workspace'">
        <div class="h-full w-1 shrink-0" aria-hidden="true" @mouseenter="revealSidebar" />

        <Transition
          enter-active-class="transition-[translate,opacity] duration-75 ease-out"
          enter-from-class="-translate-x-full opacity-0"
          leave-active-class="transition-[translate,opacity] duration-75 ease-out"
          leave-to-class="-translate-x-full opacity-0"
        >
          <div
            v-if="store.sidebarPeek"
            class="absolute inset-y-0 start-1 z-30 w-64 overflow-hidden rounded-xl border border-border/50 bg-sidebar shadow-2xl"
            @mouseleave="hideSidebar"
          >
            <AppSidebar
              @add-profile="targetDialog = 'profile'"
              @add-resource="targetDialog = 'resource'"
            />
          </div>
        </Transition>
      </template>

      <main
        class="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card"
      >
        <SettingsPage
          v-if="store.route === 'settings'"
          @add-profile="targetDialog = 'profile'"
          @add-resource="targetDialog = 'resource'"
        />

        <template v-else>
          <TerminalSearch />

          <div v-if="store.activeTab" class="flex min-h-0 flex-1 overflow-hidden">
            <PaneLayout
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

    <!-- Crash recovery is offered, never forced, and replays nothing. -->
    <Dialog :open="store.recoveryAvailable" @update:open="store.dismissRecovery(false)">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restaurer la session précédente ?</DialogTitle>
          <DialogDescription>
            Terminarr s’est arrêté sans fermeture propre. La disposition peut être rétablie. Aucune
            commande n’est rejouée et aucune connexion SSH n’est rouverte automatiquement.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="store.dismissRecovery(false)">Démarrage propre</Button>
          <Button class="active:scale-[0.96]" @click="store.dismissRecovery(true)">
            Restaurer la disposition
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
