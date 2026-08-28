<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import IconGlyph from './IconGlyph.vue'
const store = useAppStore()
const query = ref('')
const input = ref<HTMLInputElement>()
const actions = computed(() =>
  [
    {
      id: 'terminal',
      label: 'Nouveau terminal',
      detail: 'PowerShell',
      icon: 'Terminal',
      run: () => store.createTerminal(),
    },
    {
      id: 'split-h',
      label: 'Diviser horizontalement',
      detail: 'Panneau actif',
      icon: 'Rows2',
      run: () => store.splitActiveTab('horizontal'),
    },
    ...store.tree
      .flatMap((node) => [...(node.kind === 'folder' ? (node.children ?? []) : [node])])
      .filter((node) => node.kind !== 'folder')
      .map((node) => ({
        id: `target-${node.id}`,
        label: `Ouvrir ${node.name}`,
        detail: node.kind === 'resource' ? 'Ressource SSH' : 'Profil local',
        icon: node.icon ?? 'Terminal',
        run: () => store.openSidebarNode(node),
      })),
    ...store.workspaces.map((w) => ({
      id: w.id,
      label: `Ouvrir ${w.name}`,
      detail: 'Workspace',
      icon: w.icon,
      run: () => store.switchWorkspace(w.id),
    })),
    {
      id: 'settings',
      label: 'Ouvrir les réglages',
      detail: 'Apparence et raccourcis',
      icon: 'Settings',
      run: () => {
        store.settingsOpen = true
      },
    },
  ].filter((a) => `${a.label} ${a.detail}`.toLowerCase().includes(query.value.toLowerCase())),
)
function choose(action: (typeof actions.value)[number]) {
  action.run()
  store.paletteOpen = false
  query.value = ''
}
watch(
  () => store.paletteOpen,
  (open) => {
    if (open) void nextTick(() => input.value?.focus())
  },
)
</script>
<template>
  <Teleport to="body"
    ><div v-if="store.paletteOpen" class="overlay" @mousedown.self="store.paletteOpen = false">
      <section class="palette" role="dialog" aria-modal="true" aria-label="Palette de commandes">
        <label
          ><IconGlyph name="Search" /><input
            ref="input"
            v-model="query"
            placeholder="Rechercher une action, un serveur, un workspace…"
            @keydown.esc="store.paletteOpen = false"
            @keydown.enter="actions[0] && choose(actions[0])"
        /></label>
        <div class="palette-results">
          <button v-for="action in actions" :key="action.id" @click="choose(action)">
            <span class="command-icon"><IconGlyph :name="action.icon" /></span
            ><span
              ><strong>{{ action.label }}</strong
              ><small>{{ action.detail }}</small></span
            ><IconGlyph name="CornerDownLeft" :size="14" />
          </button>
          <p v-if="!actions.length">Aucun résultat</p>
        </div>
      </section>
    </div></Teleport
  >
</template>
