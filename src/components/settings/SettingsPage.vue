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
  Shield,
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
import ProfilesSection from './sections/ProfilesSection.vue'
import ResourcesSection from './sections/ResourcesSection.vue'
import SecuritySection from './sections/SecuritySection.vue'
import TerminalSection from './sections/TerminalSection.vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ addProfile: []; addResource: [] }>()

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
    keywords: 'police taille curseur historique lecteur écran',
  },
  { id: 'keybindings', label: 'Raccourcis', icon: Keyboard, keywords: 'clavier touches chords' },
  {
    id: 'profiles',
    label: 'Profils locaux',
    icon: SquareTerminal,
    keywords: 'powershell cmd wsl shell',
  },
  {
    id: 'resources',
    label: 'Ressources SSH',
    icon: Server,
    keywords: 'ssh hôte identité clé alias',
  },
  { id: 'security', label: 'Sécurité', icon: Shield, keywords: 'pin verrouillage confidentialité' },
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
  <div class="flex min-h-0 flex-1">
    <!-- Rail: the sections, searchable, plus the way back to the terminal. -->
    <nav
      class="flex w-56 shrink-0 flex-col bg-background text-sidebar-foreground"
      aria-label="Sections des réglages"
    >
      <div class="flex h-12 items-center gap-2 px-3">
        <SquareTerminal :size="16" :stroke-width="1.5" class="shrink-0" />
        <span class="truncate text-sm font-semibold">Terminarr</span>
      </div>

      <div class="px-2 pb-2">
        <div class="relative">
          <Search
            :size="14"
            :stroke-width="1.5"
            class="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="filter"
            class="h-8 ps-8 text-sm"
            placeholder="Rechercher"
            aria-label="Rechercher un réglage"
          />
        </div>
      </div>

      <div class="no-scrollbar min-h-0 flex-1 space-y-px overflow-y-auto px-2 pb-2">
        <button
          v-for="section in matches"
          :key="section.id"
          class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150"
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
          class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          @click="store.route = 'workspace'"
        >
          <ArrowLeft :size="15" :stroke-width="1.5" />
          Retour au terminal
        </button>
      </div>
    </nav>

    <!-- Content -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      <header class="flex h-12 shrink-0 items-center justify-between gap-4 px-6">
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
          Rétablir les valeurs par défaut
        </Button>
      </header>

      <Separator />

      <div class="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-2xl px-6 py-8">
          <GeneralSection v-if="active.id === 'general'" />
          <AppearanceSection v-else-if="active.id === 'appearance'" />
          <TerminalSection v-else-if="active.id === 'terminal'" />
          <KeybindingsSection v-else-if="active.id === 'keybindings'" />
          <ProfilesSection v-else-if="active.id === 'profiles'" @add="emit('addProfile')" />
          <ResourcesSection v-else-if="active.id === 'resources'" @add="emit('addResource')" />
          <SecuritySection v-else-if="active.id === 'security'" />
          <DataSection v-else-if="active.id === 'data'" />
          <AboutSection v-else-if="active.id === 'about'" />
        </div>
      </div>
    </div>
  </div>
</template>
