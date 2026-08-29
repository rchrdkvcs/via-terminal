<script setup lang="ts">
import { ref } from 'vue'
import { Download, Upload } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { api, describeError, isNative } from '@/ipc/client'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const exportMessage = ref('')
const importPayload = ref('')
const importMessage = ref('')

async function exportData() {
  try {
    const json = await api.exportData()
    await navigator.clipboard.writeText(json)
    exportMessage.value = `Export copié (${(json.length / 1024).toFixed(1)} Ko).`
  } catch (error) {
    exportMessage.value = describeError(error)
  }
}

/** Validate first, show what will land, then apply — never the other way round. */
async function validateAndApply() {
  importMessage.value = ''
  try {
    const preview = await api.validateImport(importPayload.value)
    const counts = [
      `${preview.workspaces.length} espace(s)`,
      `${preview.resources.length} ressource(s)`,
    ].join(', ')
    if (!window.confirm(`Importer ${counts} ? De nouveaux identifiants seront attribués.`)) return
    await api.applyImport(importPayload.value)
    await store.refresh()
    importPayload.value = ''
    importMessage.value = `Import appliqué : ${counts}.`
  } catch (error) {
    importMessage.value = describeError(error)
  }
}
</script>

<template>
  <SettingsSection
    title="Données"
    description="L’export contient l’organisation seulement : ni secret, ni clé, ni contenu de terminal."
  >
    <SettingRow
      label="Exporter"
      description="Copie un document JSON versionné dans le presse-papiers."
    >
      <Button
        variant="outline"
        class="active:scale-[0.96]"
        :disabled="!isNative()"
        @click="exportData"
      >
        <Download :stroke-width="1.5" />
        Copier l’export
      </Button>
    </SettingRow>
    <p v-if="exportMessage" class="pb-2 text-xs text-muted-foreground" aria-live="polite">
      {{ exportMessage }}
    </p>

    <SettingRow
      label="Importer"
      description="Collez un export. Il est validé, résumé, puis appliqué avec de nouveaux identifiants."
      stacked
    >
      <Textarea
        v-model="importPayload"
        rows="5"
        spellcheck="false"
        placeholder='{"workspaces":[…]}'
        class="font-mono text-xs"
        aria-label="Document d’import"
      />
      <div class="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          class="active:scale-[0.96]"
          :disabled="!isNative() || !importPayload.trim()"
          @click="validateAndApply"
        >
          <Upload :stroke-width="1.5" />
          Valider et importer
        </Button>
        <p v-if="importMessage" class="text-xs text-muted-foreground" aria-live="polite">
          {{ importMessage }}
        </p>
      </div>
    </SettingRow>
  </SettingsSection>
</template>
