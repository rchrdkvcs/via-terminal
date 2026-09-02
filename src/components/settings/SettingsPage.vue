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
  Search,
  Server,
  SquareTerminal,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
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
const filter = ref('')

const sections = [
  {
    id: 'general',
    label: 'Général',
    icon: Cog,
    keywords: 'densité délai confirmation restauration',
  },
  { id: 'appearance', label: 'Apparence', icon: Palette, keywords: 'thème sombre clair aperçu' },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: SquareTerminal,
    keywords: 'police taille curseur historique lecteur écran powershell cmd wsl',
  },
  { id: 'keybindings', label: 'Raccourcis', icon: Keyboard, keywords: 'clavier touches chords' },
  {
    id: 'resources',
    label: 'Ressources SSH',
    icon: Server,
    keywords: 'ssh hôte identité clé alias',
  },
  { id: 'data', label: 'Données', icon: Database, keywords: 'export import sauvegarde json' },
  { id: 'about', label: 'À propos', icon: Info, keywords: 'version licence diagnostic' },
]

const matches = computed(() => {
  const query = filter.value.trim().toLowerCase()
  if (!query) return sections
  return sections.filter((section) =>
    `${section.label} ${section.keywords}`.toLowerCase().includes(query),
  )
})

const active = computed(
  () => sections.find((section) => section.id === store.settingsSection) ?? sections[0],
)

function restoreDefaults() {
  if (!window.confirm('Rétablir les réglages par défaut de cette section ?')) return
  store.restoreDefaults(active.value.id)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col sm:flex-row">
    <!-- Rail: the sections, searchable, plus the way back to the terminal. -->
    <nav
      class="flex w-full shrink-0 flex-col bg-background text-sidebar-foreground sm:w-56"
      aria-label="Sections des réglages"
    >
      <div class="hidden h-12 items-center gap-2 px-3 sm:flex">
        <img src="/logo.svg" alt="" class="size-5 shrink-0 rounded" />
        <span class="truncate text-sm font-semibold">Via</span>
      </div>

      <div class="px-2 py-2 sm:pt-0">
        <div class="relative">
          <Search
            :size="14"
            :stroke-width="1.5"
            class="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="filter"
            class="h-9 ps-8 text-sm"
            placeholder="Rechercher"
            aria-label="Rechercher un réglage"
          />
        </div>
      </div>

      <div
        class="no-scrollbar flex min-h-0 gap-1 overflow-x-auto px-2 pb-2 sm:block sm:flex-1 sm:space-y-1 sm:overflow-y-auto"
      >
        <button
          v-for="section in matches"
          :key="section.id"
          class="flex h-9 w-auto shrink-0 items-center gap-2 rounded-md px-2.5 text-sm transition-colors duration-150 sm:w-full"
          :class="
            section.id === store.settingsSection
              ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
          "
          :aria-current="section.id === store.settingsSection ? 'page' : undefined"
          @click="store.settingsSection = section.id"
        >
          <component :is="section.icon" :size="15" :stroke-width="1.5" class="shrink-0" />
          <span class="truncate">{{ section.label }}</span>
        </button>
        <p v-if="!matches.length" class="px-2 py-4 text-xs text-muted-foreground">
          Aucune section ne correspond.
        </p>
      </div>

      <div class="border-t p-2">
        <button
          class="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          @click="store.route = 'workspace'"
        >
          <ArrowLeft :size="15" :stroke-width="1.5" />
          Retour au terminal
        </button>
      </div>
    </nav>

    <!-- Content -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      <header class="flex h-12 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        <nav class="flex min-w-0 items-center gap-2 text-sm" aria-label="Fil d’Ariane">
          <span class="text-muted-foreground">Réglages</span>
          <span class="text-muted-foreground/60">/</span>
          <span class="truncate font-medium">{{ active.label }}</span>
        </nav>
        <Button
          variant="ghost"
          size="sm"
          class="shrink-0 gap-2 text-muted-foreground active:scale-[0.96]"
          @click="restoreDefaults"
        >
          <RotateCcw :size="14" :stroke-width="1.5" />
          <span class="hidden md:inline">Rétablir les valeurs par défaut</span>
        </Button>
      </header>

      <Separator />

      <div class="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
          <GeneralSection v-if="active.id === 'general'" />
          <AppearanceSection v-else-if="active.id === 'appearance'" />
          <TerminalSection v-else-if="active.id === 'terminal'" />
          <KeybindingsSection v-else-if="active.id === 'keybindings'" />
          <ResourcesSection v-else-if="active.id === 'resources'" @add="emit('addResource')" />
          <DataSection v-else-if="active.id === 'data'" />
          <AboutSection v-else-if="active.id === 'about'" />
        </div>
      </div>
    </div>
  </div>
</template>
