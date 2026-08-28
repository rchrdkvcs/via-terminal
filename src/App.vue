<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PanelLeftOpen, Terminal } from '@lucide/vue'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import LockScreen from '@/components/LockScreen.vue'
import PaneLayout from '@/components/workspace/PaneLayout.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import TabBar from '@/components/workspace/TabBar.vue'
import TargetDialog from '@/components/TargetDialog.vue'
import TerminalSearch from '@/components/TerminalSearch.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
const revealTimer = ref<ReturnType<typeof setTimeout>>()
let unbind: (() => void) | undefined

const closingTab = computed(
  () => store.tabs.find((tab) => tab.id === store.pendingTabClose) ?? null,
)

/**
 * PRODUCT.md asks for a delayed edge reveal so a pointer crossing the window
 * edge does not flash the sidebar back open.
 */
function armReveal() {
  clearTimeout(revealTimer.value)
  revealTimer.value = setTimeout(() => {
    store.sidebarVisible = true
  }, store.preferences.sidebarRevealDelay)
}

function cancelReveal() {
  clearTimeout(revealTimer.value)
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

onMounted(async () => {
  unbind = store.bindNativeEvents()
  await store.initialize()
})

onBeforeUnmount(() => {
  clearTimeout(revealTimer.value)
  unbind?.()
})

// Closing the window detaches its views; the sessions stay owned by Rust.
window.addEventListener('beforeunload', () => {
  void store.persistWindowState()
  terminals.releaseAll()
})
</script>

<template>
  <div class="flex h-full min-h-0 overflow-hidden bg-background text-foreground">
    <Transition
      enter-active-class="transition-[opacity] duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-[opacity] duration-150 ease-out"
      leave-to-class="opacity-0"
    >
      <AppSidebar
        v-if="store.sidebarVisible"
        @add-profile="targetDialog = 'profile'"
        @add-resource="targetDialog = 'resource'"
      />
    </Transition>

    <!-- Edge strip: the only affordance for a hidden sidebar, hence its tooltip. -->
    <button
      v-if="!store.sidebarVisible"
      class="group absolute inset-y-0 start-0 z-20 w-2 cursor-e-resize"
      aria-label="Afficher la barre latérale"
      @mouseenter="armReveal"
      @mouseleave="cancelReveal"
      @focus="store.sidebarVisible = true"
      @click="store.sidebarVisible = true"
    >
      <span
        class="absolute inset-y-0 start-0 w-0.5 bg-primary/0 transition-colors duration-150 group-hover:bg-primary/60"
      />
      <PanelLeftOpen class="sr-only" />
    </button>

    <main class="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <TabBar />
      <TerminalSearch />

      <div v-if="store.activeTab" class="flex min-h-0 flex-1">
        <PaneLayout
          :key="store.activeTab.id"
          :node="store.activeTab.root"
          :closable="store.activeTab.root.kind === 'split'"
        />
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-8">
        <span class="grid size-16 place-items-center rounded-2xl bg-accent text-primary shadow-lg">
          <Terminal :size="28" :stroke-width="1.5" />
        </span>
        <div class="max-w-sm space-y-2 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">Prêt quand vous l’êtes.</h1>
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
    </main>

    <CommandPalette />
    <SettingsDialog />
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
  </div>
</template>
