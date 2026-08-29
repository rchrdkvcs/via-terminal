<script setup lang="ts">
import { computed } from 'vue'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { isNative } from '@/ipc/client'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const facts = computed(() => [
  { label: 'Version', value: '0.1.0' },
  { label: 'Hôte', value: isNative() ? 'Application native (Tauri)' : 'Aperçu navigateur' },
  { label: 'Licence', value: 'Apache-2.0' },
  {
    label: 'Shells détectés',
    value: store.detectedShells.length ? store.detectedShells.join(', ') : 'aucun',
  },
  { label: 'Sessions actives', value: String(store.sessions.length) },
  { label: 'Espaces de travail', value: String(store.workspaces.length) },
])
</script>

<template>
  <SettingsSection title="À propos" description="Terminarr, terminal natif pour techniciens.">
    <SettingRow v-for="fact in facts" :key="fact.label" :label="fact.label">
      <span class="font-mono text-xs text-muted-foreground">{{ fact.value }}</span>
    </SettingRow>
  </SettingsSection>
</template>
