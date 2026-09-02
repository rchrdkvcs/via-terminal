<script setup lang="ts">
import SettingsSection from '../SettingsSection.vue'

/**
 * V1 ships a fixed set of chords. They are listed rather than editable so the
 * page tells the truth about what the application actually does.
 */
const groups = [
  {
    title: 'Fenêtre',
    items: [
      { keys: 'Ctrl B', label: 'Afficher ou masquer la barre latérale' },
      { keys: 'Ctrl K', label: 'Ouvrir la palette de commandes' },
      { keys: 'Ctrl Maj N', label: 'Nouvelle fenêtre' },
      { keys: 'Ctrl Maj L', label: 'Verrouiller Via' },
    ],
  },
  {
    title: 'Sessions',
    items: [
      { keys: 'Ctrl T', label: 'Nouveau terminal' },
      { keys: 'Ctrl W', label: 'Fermer l’onglet actif' },
      { keys: 'Ctrl Maj "', label: 'Diviser horizontalement' },
      { keys: 'Ctrl Maj %', label: 'Diviser verticalement' },
      { keys: 'Ctrl Maj F', label: 'Rechercher dans la sortie' },
      { keys: 'Ctrl clic', label: 'Ouvrir un lien dans le navigateur système' },
    ],
  },
  {
    title: 'Espaces de travail',
    items: [
      { keys: 'Alt 1 … 9', label: 'Aller à l’espace de travail' },
      { keys: 'Ctrl molette', label: 'Faire défiler les espaces au-dessus de la barre latérale' },
    ],
  },
  {
    title: 'Barre latérale',
    items: [
      { keys: 'Alt ↑ / ↓', label: 'Déplacer l’élément sélectionné' },
      { keys: 'Ctrl clic', label: 'Ouvrir une seconde session sur la même cible' },
    ],
  },
]
</script>

<template>
  <SettingsSection
    title="Raccourcis"
    description="Les raccourcis de V1 sont fixes. Le terminal reçoit toutes les autres touches."
  >
    <div v-for="group in groups" :key="group.title" class="py-3.5">
      <h3 class="pb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {{ group.title }}
      </h3>
      <dl class="space-y-1.5">
        <div v-for="item in group.items" :key="item.keys" class="flex items-start gap-3 sm:gap-4">
          <dt class="w-24 shrink-0 sm:w-32">
            <kbd class="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {{ item.keys }}
            </kbd>
          </dt>
          <dd class="min-w-0 text-sm leading-relaxed text-muted-foreground">{{ item.label }}</dd>
        </div>
      </dl>
    </div>
  </SettingsSection>
</template>
