<script setup lang="ts">
import { useAppStore } from '../stores/app'
import IconGlyph from './IconGlyph.vue'
import TreeNode from './TreeNode.vue'
const store = useAppStore()
function onWheel(event: WheelEvent) {
  if (event.ctrlKey) {
    event.preventDefault()
    store.cycleWorkspace(event.deltaY > 0 ? 1 : -1)
  }
}
</script>
<template>
  <aside class="sidebar" aria-label="Navigation principale" @wheel="onWheel">
    <div class="traffic-spacer">
      <button
        class="sidebar-toggle"
        title="Masquer la barre latérale"
        @click="store.sidebarVisible = false"
      >
        <IconGlyph name="PanelLeftClose" />
      </button>
    </div>
    <div class="favorites" aria-label="Favoris">
      <button
        v-for="favorite in store.favorites"
        :key="favorite.id"
        class="favorite"
        :title="favorite.name"
        @click="favorite.sessionId ? undefined : store.createTerminal(favorite.name)"
      >
        <IconGlyph :name="favorite.icon" :size="20" /><span class="sr-only">{{
          favorite.name
        }}</span>
        <i v-if="favorite.sessionId" class="live-dot" />
      </button>
    </div>
    <header class="workspace-title">
      <div>
        <span class="eyebrow">Espace de travail</span
        ><strong>{{ store.activeWorkspace?.name }}</strong>
      </div>
      <button aria-label="Options du workspace"><IconGlyph name="MoreHorizontal" /></button>
    </header>
    <nav class="sidebar-tree" aria-label="Ressources">
      <ul class="tree-list">
        <TreeNode
          v-for="node in store.tree"
          :key="node.id"
          :node="node"
          @open="store.createTerminal($event.name)"
        />
      </ul>
      <button class="new-terminal" @click="store.createTerminal()">
        <IconGlyph name="Plus" /> Nouveau terminal <kbd>Ctrl T</kbd>
      </button>
    </nav>
    <footer class="sidebar-footer">
      <div class="utility-actions">
        <button @click="store.paletteOpen = true">
          <IconGlyph name="Search" /><span>Rechercher</span><kbd>Ctrl K</kbd></button
        ><button>
          <IconGlyph name="Activity" /><span>Activité</span><i class="notification-dot" />
        </button>
      </div>
      <div class="workspace-switcher" aria-label="Changer de workspace">
        <button
          v-for="workspace in store.workspaces.slice(0, 5)"
          :key="workspace.id"
          class="workspace-icon"
          :class="{ active: workspace.id === store.activeWorkspaceId }"
          :style="{ '--accent': workspace.color }"
          :aria-label="workspace.name"
          @click="store.switchWorkspace(workspace.id)"
        >
          <IconGlyph :name="workspace.icon" /><i
            v-if="workspace.activity"
            class="notification-dot"
          />
        </button>
        <button
          class="workspace-icon"
          aria-label="Créer un workspace"
          @click="store.createWorkspace()"
        >
          <IconGlyph name="Plus" />
        </button>
      </div>
    </footer>
  </aside>
</template>
