<script setup lang="ts">
import { ref } from 'vue'
import { Download, Upload } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { api, describeError, isNative } from '@/ipc/client'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const exportMessage = ref('')
const exportError = ref(false)
const importPayload = ref('')
const importMessage = ref('')
const importError = ref(false)
const importSummary = ref('')

async function exportData() {
  try {
    const json = await api.exportData()
    await navigator.clipboard.writeText(json)
    exportMessage.value = `Export copié (${(json.length / 1024).toFixed(1)} Ko).`
    exportError.value = false
  } catch (error) {
    exportMessage.value = describeError(error)
    exportError.value = true
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
    importSummary.value = counts
  } catch (error) {
    importError.value = true
    importMessage.value = describeError(error)
  }
}

async function applyImport() {
  try {
    await api.applyImport(importPayload.value)
    await store.refresh()
    importPayload.value = ''
    importMessage.value = `Import appliqué : ${importSummary.value}.`
    importError.value = false
    importSummary.value = ''
  } catch (error) {
    importError.value = true
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
    <Alert v-if="exportMessage" :variant="exportError ? 'destructive' : 'default'" class="mb-2"
      ><AlertDescription>{{ exportMessage }}</AlertDescription></Alert
    >

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
      </div>
      <Alert v-if="importMessage" :variant="importError ? 'destructive' : 'default'" class="mt-3">
        <AlertDescription>{{ importMessage }}</AlertDescription>
      </Alert>
    </SettingRow>
    <AlertDialog
      :open="Boolean(importSummary)"
      @update:open="importSummary = $event ? importSummary : ''"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Importer ces données ?</AlertDialogTitle>
          <AlertDialogDescription>
            L’import ajoutera {{ importSummary }}. De nouveaux identifiants seront attribués.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="importSummary = ''">Annuler</AlertDialogCancel>
          <AlertDialogAction @click="applyImport">Importer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SettingsSection>
</template>
