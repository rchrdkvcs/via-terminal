<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
</script>

<template>
  <SettingsSection title="Général" description="Comportement de la fenêtre et des sessions.">
    <SettingRow
      label="Délai de réapparition de la barre latérale"
      description="Temps que le pointeur doit rester sur le bord gauche avant l’ouverture. En millisecondes."
      for-id="reveal-delay"
    >
      <InputGroup class="w-28">
        <InputGroupInput
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
        <InputGroupAddon align="inline-end"><InputGroupText>ms</InputGroupText></InputGroupAddon>
      </InputGroup>
    </SettingRow>

    <SettingRow
      label="Délai de disparition"
      description="Temps avant que la barre latérale se referme une fois le pointeur parti. En millisecondes."
      for-id="hide-delay"
    >
      <InputGroup class="w-28">
        <InputGroupInput
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
        <InputGroupAddon align="inline-end"><InputGroupText>ms</InputGroupText></InputGroupAddon>
      </InputGroup>
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
      label="Connexion manuelle des favoris"
      description="Sélectionner un favori arrêté sans démarrer immédiatement son terminal ou sa connexion."
      for-id="manual-favorites"
    >
      <Switch
        id="manual-favorites"
        :model-value="store.preferences.startFavoritesManually"
        @update:model-value="store.updatePreferences({ startFavoritesManually: $event })"
      />
    </SettingRow>
  </SettingsSection>
</template>
