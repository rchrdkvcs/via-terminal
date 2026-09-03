<script setup lang="ts">
/** PROTOTYPE — Trois layouts Réglages, pilotés par ?variant=a|b|c. */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
import SettingsPrototypeSwitcher from './prototypes/SettingsPrototypeSwitcher.vue'
import SettingsVariantA from './prototypes/SettingsVariantA.vue'
import SettingsVariantB from './prototypes/SettingsVariantB.vue'
import SettingsVariantC from './prototypes/SettingsVariantC.vue'
import { settingsSections } from './prototypes/settingsPrototype'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ addResource: [] }>()
const store = useAppStore()
const confirmRestore = ref(false)
const showPrototypeSwitcher = import.meta.env.DEV
const variants = [
  { id: 'a', name: 'Rail calme', component: SettingsVariantA },
  { id: 'b', name: 'Vue d’ensemble', component: SettingsVariantB },
  { id: 'c', name: 'Sommaire flottant', component: SettingsVariantC },
] as const

function readVariant() {
  const value = new URLSearchParams(window.location.search).get('variant')?.toLowerCase()
  return variants.some((variant) => variant.id === value) ? (value as 'a' | 'b' | 'c') : 'a'
}

const currentVariant = ref(readVariant())
const activeVariant = computed(
  () => variants.find((item) => item.id === currentVariant.value) ?? variants[0],
)
const activeSection = computed(
  () => settingsSections.find((item) => item.id === store.settingsSection) ?? settingsSections[0],
)

function selectVariant(id: string) {
  const next = variants.find((item) => item.id === id)?.id ?? 'a'
  const url = new URL(window.location.href)
  url.searchParams.set('variant', next)
  window.history.replaceState({}, '', url)
  currentVariant.value = next
}
function restoreDefaults() {
  store.restoreDefaults(activeSection.value.id)
  confirmRestore.value = false
}
function onPopState() {
  currentVariant.value = readVariant()
}
onMounted(() => window.addEventListener('popstate', onPopState))
onBeforeUnmount(() => window.removeEventListener('popstate', onPopState))
</script>

<template>
  <component
    :is="activeVariant.component"
    @add-resource="emit('addResource')"
    @restore="confirmRestore = true"
  />
  <SettingsPrototypeSwitcher
    v-if="showPrototypeSwitcher"
    :variants="variants"
    :current="currentVariant"
    @select="selectVariant"
  />
  <AlertDialog v-model:open="confirmRestore">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Rétablir les valeurs par défaut ?</AlertDialogTitle>
        <AlertDialogDescription
          >Tous les réglages de la section « {{ activeSection.label }} » seront
          réinitialisés.</AlertDialogDescription
        >
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction @click="restoreDefaults">Rétablir</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
