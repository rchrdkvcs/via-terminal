<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { Settings } from '@/ipc/types'
import { useSettings } from '@/stores/settings'
import FontPreview from '../FontPreview.vue'
import SettingChoice from '../SettingChoice.vue'
import SettingGroup from '../SettingGroup.vue'
import SettingRow from '../SettingRow.vue'
import SettingSlider from '../SettingSlider.vue'

const store = useSettings()

const MIN_SIZE = 10
const MAX_SIZE = 24

const themes: { value: Settings['theme']; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

const cursors: { value: Settings['cursorStyle']; label: string }[] = [
  { value: 'bar', label: 'Barre' },
  { value: 'block', label: 'Bloc' },
  { value: 'underline', label: 'Souligné' },
]

function setSize(size: number) {
  store.update({ fontSize: Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) })
}
</script>

<template>
  <div class="grid gap-8">
    <SettingGroup title="Interface">
      <SettingRow
        v-slot="{ labelId }"
        label="Thème"
        description="Système suit le réglage clair ou sombre de l'ordinateur."
      >
        <SettingChoice
          :options="themes"
          :labelledby="labelId"
          :model-value="store.settings.theme"
          @update:model-value="(theme) => store.update({ theme })"
        />
      </SettingRow>
    </SettingGroup>

    <SettingGroup title="Texte du terminal">
      <SettingRow
        v-slot="{ id, descriptionId }"
        label="Police du terminal"
        description="Tapez le nom d'une police installée, ou laissez vide pour IBM Plex Mono."
      >
        <Input
          :id="id"
          class="h-7 w-60"
          placeholder="IBM Plex Mono"
          spellcheck="false"
          autocomplete="off"
          :aria-describedby="descriptionId"
          :model-value="store.settings.fontFamily"
          @update:model-value="(value) => store.update({ fontFamily: String(value) })"
          @change="store.update({ fontFamily: store.settings.fontFamily.trim() })"
        />
      </SettingRow>

      <SettingRow label="Taille" description="Taille du texte dans le terminal, en pixels.">
        <SettingSlider
          label="Taille"
          :min="MIN_SIZE"
          :max="MAX_SIZE"
          :step="1"
          :format="(value) => `${value} px`"
          :model-value="store.settings.fontSize"
          @update:model-value="setSize"
        />
      </SettingRow>

      <SettingRow label="Espacement des lettres" description="Pixels ajoutés entre les caractères.">
        <SettingSlider
          label="Espacement des lettres"
          :min="0"
          :max="4"
          :step="0.5"
          :format="(value) => `${value} px`"
          :model-value="store.settings.letterSpacing"
          @update:model-value="(letterSpacing) => store.update({ letterSpacing })"
        />
      </SettingRow>

      <SettingRow
        v-slot="{ labelId }"
        label="Curseur"
        description="Forme du curseur à l'invite de commande."
      >
        <SettingChoice
          :options="cursors"
          :labelledby="labelId"
          :model-value="store.settings.cursorStyle"
          @update:model-value="(cursorStyle) => store.update({ cursorStyle })"
        />
      </SettingRow>

      <SettingRow v-slot="{ id }" label="Clignotement du curseur">
        <Switch
          :id="id"
          :model-value="store.settings.cursorBlink"
          @update:model-value="(on: boolean) => store.update({ cursorBlink: on })"
        />
      </SettingRow>
    </SettingGroup>

    <section aria-label="Aperçu" class="grid gap-2.5">
      <h3 class="px-1 text-[13px] font-semibold tracking-[-0.005em]">Aperçu</h3>
      <FontPreview />
    </section>
  </div>
</template>
