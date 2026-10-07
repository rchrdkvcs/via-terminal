<script setup lang="ts">
import { ref } from 'vue'
import { version } from '../../../package.json'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/stores/settings'
import { useUpdates } from '@/stores/updates'
import SettingRow from './SettingRow.vue'

const settings = useSettings()
const updates = useUpdates()
const checked = ref(false)
async function check() {
  await updates.check(true)
  checked.value = !updates.error
}
</script>

<template>
  <section aria-label="Mises à jour" class="mt-6">
    <h3 class="mb-2 text-sm font-medium">Mises à jour</h3>
    <SettingRow
      v-slot="{ id, descriptionId }"
      label="Vérifier au démarrage"
      description="Recherche une nouvelle version sur GitHub. Aucune donnée du coffre ou des terminaux n’est envoyée."
    >
      <Switch
        :id="id"
        :aria-describedby="descriptionId"
        :model-value="settings.settings.checkForUpdates"
        @update:model-value="(on: boolean) => settings.update({ checkForUpdates: on })"
      />
    </SettingRow>
    <SettingRow label="Version installée" :description="`Via ${version}`">
      <Button
        variant="secondary"
        size="sm"
        :disabled="updates.busy || updates.phase === 'installed'"
        @click="check"
      >
        {{ updates.phase === 'checking' ? 'Vérification…' : 'Vérifier les mises à jour' }}
      </Button>
    </SettingRow>
    <p v-if="updates.error" role="alert" class="mt-2 text-xs text-destructive">
      {{ updates.error }}
    </p>
    <p v-else-if="updates.version" role="status" class="mt-2 text-xs text-muted-foreground">
      La version {{ updates.version }} est disponible.
    </p>
    <p v-else-if="checked" role="status" class="mt-2 text-xs text-muted-foreground">
      Via est à jour.
    </p>
  </section>
</template>
