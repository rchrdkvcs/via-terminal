<script setup lang="ts">
import { computed } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/stores/settings'
import SettingRow from '../SettingRow.vue'
import SettingSlider from '../SettingSlider.vue'

const store = useSettings()

const presets = [1_000, 5_000, 10_000, 50_000, 100_000]
const number = new Intl.NumberFormat('fr-FR')

const scrollbackOptions = computed(() => {
  const current = store.settings.scrollback
  const values = presets.includes(current) ? presets : [...presets, current].sort((a, b) => a - b)
  return values.map((value) => ({ value: String(value), label: `${number.format(value)} lignes` }))
})

function onScrollback(value: unknown) {
  const lines = Number(value)
  if (Number.isFinite(lines) && lines > 0) store.update({ scrollback: lines })
}
</script>

<template>
  <section aria-label="Terminal">
    <SettingRow
      v-slot="{ id, descriptionId }"
      label="Historique"
      description="Lignes gardées en mémoire pour remonter dans la sortie."
    >
      <Select :model-value="String(store.settings.scrollback)" @update:model-value="onScrollback">
        <SelectTrigger
          :id="id"
          size="sm"
          class="w-40 text-[13px]"
          :aria-describedby="descriptionId"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in scrollbackOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <SettingRow
      label="Hauteur de ligne"
      description="Espace vertical entre les lignes du terminal."
    >
      <SettingSlider
        label="Hauteur de ligne"
        :min="1"
        :max="1.6"
        :step="0.05"
        :format="(value) => value.toFixed(2)"
        :model-value="store.settings.lineHeight"
        @update:model-value="(value) => store.update({ lineHeight: value })"
      />
    </SettingRow>

    <SettingRow
      v-slot="{ id, descriptionId }"
      label="Copier la sélection automatiquement"
      description="Le texte sélectionné à la souris part dans le presse-papiers."
    >
      <Switch
        :id="id"
        :aria-describedby="descriptionId"
        :model-value="store.settings.copyOnSelect"
        @update:model-value="(on: boolean) => store.update({ copyOnSelect: on })"
      />
    </SettingRow>
  </section>
</template>
