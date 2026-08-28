<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import AppSidebar from './components/AppSidebar.vue'
import CommandPalette from './components/CommandPalette.vue'
import IconGlyph from './components/IconGlyph.vue'
import LockScreen from './components/LockScreen.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import TerminalView from './components/TerminalView.vue'
import { useAppStore } from './stores/app'
const store = useAppStore()
let unlistenLock: UnlistenFn | undefined
let unlistenSession: UnlistenFn | undefined
function shortcuts(event: KeyboardEvent) {
  if (event.ctrlKey && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    store.paletteOpen = true
  }
  if (event.ctrlKey && event.key.toLowerCase() === 't') {
    event.preventDefault()
    store.createTerminal()
  }
  if (event.altKey && /^[1-9]$/.test(event.key))
    store.switchWorkspace(store.workspaces[Number(event.key) - 1]?.id ?? '')
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') void store.lock()
}
onMounted(async () => {
  void store.initialize()
  if ('__TAURI_INTERNALS__' in window) {
    unlistenLock = await listen<boolean>('app-lock-changed', ({ payload }) => {
      store.locked = payload
    })
    unlistenSession = await listen<{
      id: string
      status: import('./types').SessionStatus
      message?: string
    }>('session-status-changed', ({ payload }) =>
      store.updateSessionStatus(payload.id, payload.status, payload.message),
    )
  }
  window.addEventListener('keydown', shortcuts)
})
onUnmounted(() => {
  unlistenLock?.()
  unlistenSession?.()
  window.removeEventListener('keydown', shortcuts)
})
</script>
<template>
  <main
    class="app-shell"
    :class="[
      `theme-${store.settings.theme}`,
      `density-${store.settings.density}`,
      { 'sidebar-hidden': !store.sidebarVisible },
    ]"
  >
    <AppSidebar v-if="store.sidebarVisible" /><button
      v-else
      class="sidebar-reveal"
      aria-label="Afficher la barre latérale"
      @mouseenter="store.sidebarVisible = true"
    >
      <IconGlyph name="PanelLeftOpen" />
    </button>
    <section class="workspace-view">
      <header class="tabbar">
        <div class="tabs" role="tablist">
          <div
            v-for="tab in store.visibleTabs"
            :key="tab.id"
            role="tab"
            :aria-selected="tab.id === store.activeTabId"
            class="tab"
            :class="{ active: tab.id === store.activeTabId }"
            @click="store.activeTabId = tab.id"
          >
            <IconGlyph name="SquareTerminal" :size="15" /><span>{{ tab.name }}</span
            ><button
              class="tab-close"
              :aria-label="`Fermer ${tab.name}`"
              @click.stop="store.closeTab(tab.id)"
            >
              <IconGlyph name="X" :size="13" />
            </button>
          </div>
        </div>
        <div class="window-actions">
          <button title="Nouveau terminal" @click="store.createTerminal()">
            <IconGlyph name="Plus" /></button
          ><button title="Diviser" @click="store.splitActiveTab('vertical')">
            <IconGlyph name="Columns2" /></button
          ><button title="Réglages" @click="store.settingsOpen = true">
            <IconGlyph name="Settings" />
          </button>
        </div>
      </header>
      <div v-if="store.activeSession" class="terminal-stage">
        <div class="terminal-toolbar">
          <span
            ><i class="status-light" :class="store.activeSession.status" />{{
              store.activeSession.name
            }}</span
          ><span class="muted"
            >{{ store.activeSession.kind === 'ssh' ? 'SSH' : 'Local' }} ·
            {{ store.activeSession.status }} · {{ store.activeWorkspace?.name }}</span
          >
        </div>
        <div
          class="terminal-panes"
          :class="`split-${store.tabs.find((tab) => tab.id === store.activeTabId)?.split ?? 'none'}`"
        >
          <TerminalView :key="store.activeSession.id" :session-id="store.activeSession.id" />
          <TerminalView
            v-if="store.tabs.find((tab) => tab.id === store.activeTabId)?.secondarySessionId"
            :key="store.tabs.find((tab) => tab.id === store.activeTabId)?.secondarySessionId"
            :session-id="store.tabs.find((tab) => tab.id === store.activeTabId)?.secondarySessionId"
          />
        </div>
      </div>
      <div v-else class="empty-state">
        <span class="empty-icon"><IconGlyph name="Terminal" :size="30" /></span>
        <h1>Prêt quand vous l’êtes.</h1>
        <p>Ouvrez un terminal local ou retrouvez une ressource depuis la sidebar.</p>
        <button class="primary" @click="store.createTerminal()">
          <IconGlyph name="Plus" /> Nouveau terminal</button
        ><kbd>Ctrl T</kbd>
      </div>
    </section>
    <CommandPalette /><SettingsPanel /><LockScreen />
    <div class="notice-stack" role="status" aria-live="polite">
      <div v-for="notice in store.notices" :key="notice.id" class="notice" :class="notice.kind">
        <IconGlyph :name="notice.kind === 'error' ? 'CircleAlert' : 'Info'" />
        <span>{{ notice.message }}</span>
        <button :aria-label="'Fermer la notification'" @click="store.dismissNotice(notice.id)">
          <IconGlyph name="X" :size="14" />
        </button>
      </div>
    </div>
  </main>
</template>
