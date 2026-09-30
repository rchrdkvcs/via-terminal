<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { platformDefaultShell, shellLabel } from '@/lib/shells'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const currentShell = computed(() => store.settings.defaultShell || platformDefaultShell())

const shellChoices = computed(() => {
  const current = currentShell.value
  const detected = store.detectedShells
  const list = detected.includes(current) ? detected : [current, ...detected]
  return list.length ? list : [current]
})
</script>

<template>
  <SettingsSection
    title="Terminal"
    description="Typographie, shell par défaut et rendu des sessions."
  >
    <SettingRow
      label="Terminal par défaut"
      description="Shell proposé pour les nouveaux onglets de type Terminal local."
      for-id="default-shell"
    >
      <Select
        :model-value="currentShell"
        @update:model-value="store.updateSettings({ defaultShell: String($event) })"
      >
        <SelectTrigger id="default-shell" class="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="shell in shellChoices" :key="shell" :value="shell">
            {{ shellLabel(shell) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <SettingRow label="Police" description="Une police à chasse fixe donne le meilleur résultat.">
      <Input
        id="font-family"
        class="w-56"
        placeholder="Cascadia Mono"
        :model-value="store.settings.fontFamily"
        @update:model-value="store.updateSettings({ fontFamily: String($event) })"
      />
    </SettingRow>

    <SettingRow
      :label="`Taille de police — ${store.settings.fontSize} px`"
      description="Chaque session est remesurée immédiatement."
      for-id="font-size"
      stacked
    >
      <Slider
        id="font-size"
        :model-value="[store.settings.fontSize]"
        :min="10"
        :max="24"
        :step="1"
        @update:model-value="store.updateSettings({ fontSize: ($event ?? [14])[0] })"
      />
    </SettingRow>

    <SettingRow label="Curseur" description="Forme du curseur dans le terminal." for-id="cursor">
      <Select
        :model-value="store.preferences.cursorStyle"
        @update:model-value="
          store.updatePreferences({ cursorStyle: $event as 'block' | 'bar' | 'underline' })
        "
      >
        <SelectTrigger id="cursor" class="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="bar">Barre</SelectItem>
          <SelectItem value="block">Bloc</SelectItem>
          <SelectItem value="underline">Souligné</SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <SettingRow label="Curseur clignotant" for-id="cursor-blink">
      <Switch
        id="cursor-blink"
        :model-value="store.preferences.cursorBlink"
        @update:model-value="store.updatePreferences({ cursorBlink: $event })"
      />
    </SettingRow>

    <SettingRow
      label="Historique"
      description="Nombre de lignes conservées par session. Une valeur élevée augmente la mémoire utilisée."
      for-id="scrollback"
    >
      <Input
        id="scrollback"
        class="w-28 text-end tabular-nums"
        inputmode="numeric"
        :model-value="store.preferences.scrollback"
        @update:model-value="
          store.updatePreferences({
            scrollback: Math.min(Math.max(Number($event) || 0, 100), 100000),
          })
        "
      />
    </SettingRow>

    <SettingRow
      label="Mode lecteur d’écran"
      description="Expose le contenu du terminal à NVDA. Réduit le débit sur les sorties très volumineuses."
      for-id="screen-reader"
    >
      <Switch
        id="screen-reader"
        :model-value="store.preferences.screenReaderMode"
        @update:model-value="store.updatePreferences({ screenReaderMode: $event })"
      />
    </SettingRow>
  </SettingsSection>
</template>
