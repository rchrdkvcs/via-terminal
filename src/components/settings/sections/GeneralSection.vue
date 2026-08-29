<script setup lang="ts">
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { densityLabels } from '@/lib/preferences'
import type { Density } from '@/ipc/types'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
</script>

<template>
  <SettingsSection title="Général" description="Comportement de la fenêtre et des sessions.">
    <SettingRow
      label="Densité"
      description="Hauteur des lignes de la barre latérale."
      for-id="density"
    >
      <Select
        :model-value="store.settings.density"
        @update:model-value="store.setDensity($event as Density)"
      >
        <SelectTrigger id="density" class="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="(label, value) in densityLabels" :key="value" :value="value">
            {{ label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <SettingRow
      label="Délai de réapparition de la barre latérale"
      description="Temps que le pointeur doit rester sur le bord gauche avant l’ouverture. En millisecondes."
      for-id="reveal-delay"
    >
      <Input
        id="reveal-delay"
        class="w-24 text-end tabular-nums"
        inputmode="numeric"
        :model-value="store.preferences.sidebarRevealDelay"
        @update:model-value="
          store.updatePreferences({
            sidebarRevealDelay: Math.min(Math.max(Number($event) || 0, 0), 2000),
          })
        "
      />
    </SettingRow>

    <SettingRow
      label="Délai de disparition"
      description="Temps avant que la barre latérale se referme une fois le pointeur parti. En millisecondes."
      for-id="hide-delay"
    >
      <Input
        id="hide-delay"
        class="w-24 text-end tabular-nums"
        inputmode="numeric"
        :model-value="store.preferences.sidebarHideDelay"
        @update:model-value="
          store.updatePreferences({
            sidebarHideDelay: Math.min(Math.max(Number($event) || 0, 0), 3000),
          })
        "
      />
    </SettingRow>

    <SettingRow
      label="Confirmer la fermeture"
      description="Demander avant de fermer un onglet qui contient encore une session active."
      for-id="confirm-close"
    >
      <Switch
        id="confirm-close"
        :model-value="store.preferences.confirmOnClose"
        @update:model-value="store.updatePreferences({ confirmOnClose: $event })"
      />
    </SettingRow>

    <SettingRow
      label="Relancer les shells locaux au démarrage"
      description="Les connexions SSH ne sont jamais rétablies automatiquement et aucune commande n’est rejouée."
      for-id="restore-local"
    >
      <Switch
        id="restore-local"
        :model-value="store.settings.restoreLocalSessions"
        @update:model-value="store.updateSettings({ restoreLocalSessions: $event })"
      />
    </SettingRow>
  </SettingsSection>
</template>
