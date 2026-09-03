<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowLeft,
  Cog,
  Database,
  Info,
  Keyboard,
  Palette,
  RotateCcw,
  Server,
  SquareTerminal,
} from '@lucide/vue'
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
import { Button } from '@/components/ui/button'
import AboutSection from './sections/AboutSection.vue'
import AppearanceSection from './sections/AppearanceSection.vue'
import DataSection from './sections/DataSection.vue'
import GeneralSection from './sections/GeneralSection.vue'
import KeybindingsSection from './sections/KeybindingsSection.vue'
import ResourcesSection from './sections/ResourcesSection.vue'
import TerminalSection from './sections/TerminalSection.vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ addResource: [] }>()
const store = useAppStore()
const confirmRestore = ref(false)
const sections = [
  {
    id: 'general',
    label: 'Général',
    description: 'Fenêtre et sessions',
    icon: Cog,
    component: GeneralSection,
  },
  {
    id: 'appearance',
    label: 'Apparence',
    description: 'Thème et aperçu',
    icon: Palette,
    component: AppearanceSection,
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Shell, police et rendu',
    icon: SquareTerminal,
    component: TerminalSection,
  },
  {
    id: 'keybindings',
    label: 'Raccourcis',
    description: 'Commandes clavier',
    icon: Keyboard,
    component: KeybindingsSection,
  },
  {
    id: 'resources',
    label: 'Ressources SSH',
    description: 'Hôtes et identités',
    icon: Server,
    component: ResourcesSection,
  },
  {
    id: 'data',
    label: 'Données',
    description: 'Import et export',
    icon: Database,
    component: DataSection,
  },
  {
    id: 'about',
    label: 'À propos',
    description: 'Version et diagnostic',
    icon: Info,
    component: AboutSection,
  },
] as const
const activeSection = computed(
  () => sections.find((section) => section.id === store.settingsSection) ?? sections[0],
)
function restoreDefaults() {
  store.restoreDefaults(activeSection.value.id)
  confirmRestore.value = false
}
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-2">
    <nav class="flex w-60 shrink-0 flex-col px-3 pb-3" aria-label="Sections des réglages">
      <div class="flex h-16 items-center">
        <button
          class="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          @click="store.route = 'workspace'"
        >
          <ArrowLeft :size="15" :stroke-width="1.5" />
          Retour au terminal
        </button>
      </div>
      <div class="thin-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto">
        <button
          v-for="section in sections"
          :key="section.id"
          class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start transition-colors duration-150"
          :class="
            section.id === store.settingsSection
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          "
          :aria-current="section.id === store.settingsSection ? 'page' : undefined"
          @click="store.settingsSection = section.id"
        >
          <component :is="section.icon" :size="16" :stroke-width="1.5" class="shrink-0" />
          <span class="min-w-0"
            ><span class="block truncate text-sm font-medium">{{ section.label }}</span
            ><span class="block truncate text-[11px] opacity-70">{{
              section.description
            }}</span></span
          >
        </button>
      </div>
    </nav>

    <main
      class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card"
    >
      <header class="flex min-h-16 shrink-0 items-center justify-between gap-4 px-6">
        <div>
          <p class="text-xs font-medium text-muted-foreground">Réglages</p>
          <h1 class="text-lg font-semibold tracking-tight">{{ activeSection.label }}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="gap-2 text-muted-foreground active:scale-[0.96]"
          @click="confirmRestore = true"
        >
          <RotateCcw :size="14" :stroke-width="1.5" />
          <span class="hidden lg:inline">Valeurs par défaut</span>
        </Button>
      </header>
      <div class="thin-scrollbar min-h-0 flex-1 overflow-y-auto border-t">
        <div class="mx-auto max-w-2xl px-6 py-8">
          <Transition name="settings-section" mode="out-in">
            <component
              :is="activeSection.component"
              :key="activeSection.id"
              @add="emit('addResource')"
            />
          </Transition>
        </div>
      </div>
    </main>

    <AlertDialog v-model:open="confirmRestore">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rétablir les valeurs par défaut ?</AlertDialogTitle>
          <AlertDialogDescription
            >Tous les réglages de la section « {{ activeSection.label }} » seront
            réinitialisés.</AlertDialogDescription
          >
        </AlertDialogHeader>
        <AlertDialogFooter
          ><AlertDialogCancel>Annuler</AlertDialogCancel
          ><AlertDialogAction @click="restoreDefaults"
            >Rétablir</AlertDialogAction
          ></AlertDialogFooter
        >
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
