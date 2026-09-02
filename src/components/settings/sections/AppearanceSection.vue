<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { themeLabels } from '@/lib/preferences'
import { MONO_FONT_STACK } from '@/lib/shells'
import type { ThemePreference } from '@/ipc/types'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
</script>

<template>
  <SettingsSection title="Apparence" description="Ces choix s’appliquent à toutes les fenêtres.">
    <SettingRow label="Thème" description="« Système » suit le réglage du système." for-id="theme">
      <Select
        :model-value="store.settings.theme"
        @update:model-value="store.setTheme($event as ThemePreference)"
      >
        <SelectTrigger id="theme" class="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="(label, value) in themeLabels" :key="value" :value="value">
            {{ label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <SettingRow label="Aperçu" description="Rendu du terminal avec les réglages actuels." stacked>
      <div
        class="overflow-hidden rounded-lg border bg-[var(--terminal-preview-bg)] p-3"
        :style="{
          '--terminal-preview-bg': store.appearance === 'dark' ? '#0a0a0a' : '#ffffff',
          color: store.appearance === 'dark' ? '#fafafa' : '#171717',
          fontFamily: `${store.settings.fontFamily}, ${MONO_FONT_STACK}`,
          fontSize: `${store.settings.fontSize}px`,
          lineHeight: 1.2,
        }"
      >
        <p>
          <span class="text-[#5fd58a]">rchrdkvcs@hom01</span>:<span class="text-[#7aa5ef]">~</span>$
          via --version
        </p>
        <p>Via 0.1.0</p>
      </div>
    </SettingRow>
  </SettingsSection>
</template>
