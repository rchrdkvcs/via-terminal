<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { Settings } from '@/ipc/types'
import { useSettings } from '@/stores/settings'
import FontPreview from '../FontPreview.vue'
import SettingChoice from '../SettingChoice.vue'
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
  <section aria-label="Apparence">
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

    <SettingRow
      v-slot="{ id, descriptionId }"
      label="Police du terminal"
      description="Tapez le nom d'une police installée, ou laissez vide pour IBM Plex Mono."
    >
      <Input
        :id="id"
        class="h-8 w-56 text-[13px]"
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
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Réduire la taille"
        :disabled="store.settings.fontSize <= MIN_SIZE"
        @click="setSize(store.settings.fontSize - 1)"
      >
        <Minus :stroke-width="1.5" aria-hidden="true" />
      </Button>
      <SettingSlider
        label="Taille"
        :min="MIN_SIZE"
        :max="MAX_SIZE"
        :step="1"
        :format="(value) => `${value} px`"
        :model-value="store.settings.fontSize"
        @update:model-value="setSize"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Augmenter la taille"
        :disabled="store.settings.fontSize >= MAX_SIZE"
        @click="setSize(store.settings.fontSize + 1)"
      >
        <Plus :stroke-width="1.5" aria-hidden="true" />
      </Button>
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

    <FontPreview class="mt-3" />
  </section>
</template>
