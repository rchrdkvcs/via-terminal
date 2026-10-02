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

const store = useSettings()

/** Select items cannot hold null, so "follow the system" gets a sentinel. */
const SYSTEM = '__system__'

const systemLabel = computed(() => `Shell du système (${store.shellName(store.systemShell)})`)

const defaultShell = computed({
  get: () => {
    const path = store.settings.defaultShell
    return path && store.shells.some((shell) => shell.path === path) ? path : SYSTEM
  },
  set: (value: string) => store.update({ defaultShell: value === SYSTEM ? null : value }),
})

function onShell(value: unknown) {
  if (typeof value === 'string') defaultShell.value = value
}
</script>

<template>
  <section aria-label="Général">
    <SettingRow
      v-slot="{ id, descriptionId }"
      label="Shell par défaut"
      description="Ouvert dans les nouveaux onglets locaux, sauf si l'espace en choisit un autre."
    >
      <Select :model-value="defaultShell" @update:model-value="onShell">
        <SelectTrigger
          :id="id"
          size="sm"
          class="w-64 text-[13px]"
          :aria-describedby="descriptionId"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="SYSTEM">{{ systemLabel }}</SelectItem>
          <SelectItem v-for="shell in store.shells" :key="shell.path" :value="shell.path">
            {{ shell.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <SettingRow
      v-slot="{ id, descriptionId }"
      label="Enregistrer les connexions rapides"
      description="Un hôte tapé dans la barre de commande rejoint le coffre une fois connecté."
    >
      <Switch
        :id="id"
        :aria-describedby="descriptionId"
        :model-value="store.settings.saveQuickConnect"
        @update:model-value="(on: boolean) => store.update({ saveQuickConnect: on })"
      />
    </SettingRow>

    <SettingRow
      v-slot="{ id, descriptionId }"
      label="Confirmer avant de fermer un onglet actif"
      description="Demande une confirmation quand un processus tourne encore dans l'onglet."
    >
      <Switch
        :id="id"
        :aria-describedby="descriptionId"
        :model-value="store.settings.confirmCloseRunning"
        @update:model-value="(on: boolean) => store.update({ confirmCloseRunning: on })"
      />
    </SettingRow>
  </section>
</template>
