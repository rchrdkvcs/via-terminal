import { Cog, Database, Info, Keyboard, Palette, Server, SquareTerminal } from '@lucide/vue'
import AboutSection from '../sections/AboutSection.vue'
import AppearanceSection from '../sections/AppearanceSection.vue'
import DataSection from '../sections/DataSection.vue'
import GeneralSection from '../sections/GeneralSection.vue'
import KeybindingsSection from '../sections/KeybindingsSection.vue'
import ResourcesSection from '../sections/ResourcesSection.vue'
import TerminalSection from '../sections/TerminalSection.vue'

export const settingsSections = [
  {
    id: 'general',
    label: 'Général',
    description: 'Fenêtre et sessions',
    icon: Cog,
    component: GeneralSection,
    keywords: 'densité délai confirmation restauration',
  },
  {
    id: 'appearance',
    label: 'Apparence',
    description: 'Thème et aperçu',
    icon: Palette,
    component: AppearanceSection,
    keywords: 'thème sombre clair aperçu',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Shell, police et rendu',
    icon: SquareTerminal,
    component: TerminalSection,
    keywords: 'police taille curseur historique lecteur écran powershell cmd wsl',
  },
  {
    id: 'keybindings',
    label: 'Raccourcis',
    description: 'Commandes clavier',
    icon: Keyboard,
    component: KeybindingsSection,
    keywords: 'clavier touches chords',
  },
  {
    id: 'resources',
    label: 'Ressources SSH',
    description: 'Hôtes et identités',
    icon: Server,
    component: ResourcesSection,
    keywords: 'ssh hôte identité clé alias',
  },
  {
    id: 'data',
    label: 'Données',
    description: 'Import et export',
    icon: Database,
    component: DataSection,
    keywords: 'export import sauvegarde json',
  },
  {
    id: 'about',
    label: 'À propos',
    description: 'Version et diagnostic',
    icon: Info,
    component: AboutSection,
    keywords: 'version licence diagnostic',
  },
] as const

export function matchingSections(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return settingsSections
  return settingsSections.filter((section) =>
    `${section.label} ${section.description} ${section.keywords}`
      .toLowerCase()
      .includes(normalized),
  )
}
