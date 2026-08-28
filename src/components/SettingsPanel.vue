<script setup lang="ts">
import { useAppStore } from '../stores/app'
import IconGlyph from './IconGlyph.vue'
const store = useAppStore()
</script>
<template>
  <Teleport to="body"
    ><div v-if="store.settingsOpen" class="overlay" @mousedown.self="store.settingsOpen = false">
      <section
        class="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header>
          <div>
            <span class="eyebrow">Terminarr</span>
            <h2 id="settings-title">Réglages</h2>
          </div>
          <button aria-label="Fermer" @click="store.settingsOpen = false">
            <IconGlyph name="X" />
          </button>
        </header>
        <div class="setting">
          <div>
            <strong>Apparence</strong><small>Adaptez l’interface à votre environnement.</small>
          </div>
          <select v-model="store.settings.theme">
            <option value="dark">Sombre</option>
            <option value="light">Clair</option>
            <option value="system">Système</option>
          </select>
        </div>
        <div class="setting">
          <div><strong>Densité</strong><small>Réduit l’espacement dans la sidebar.</small></div>
          <select v-model="store.settings.density">
            <option value="comfortable">Confortable</option>
            <option value="compact">Compacte</option>
          </select>
        </div>
        <div class="setting vertical">
          <div>
            <strong>Taille du terminal</strong><small>{{ store.settings.fontSize }} pixels</small>
          </div>
          <input v-model.number="store.settings.fontSize" type="range" min="11" max="22" />
        </div>
        <footer>
          <button class="primary" @click="store.settingsOpen = false">Terminé</button>
        </footer>
      </section>
    </div></Teleport
  >
</template>
