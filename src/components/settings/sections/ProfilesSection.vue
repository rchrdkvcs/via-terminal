<script setup lang="ts">
import { Plus, SquareTerminal, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import SettingsSection from '../SettingsSection.vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ add: [] }>()

const store = useAppStore()
</script>

<template>
  <SettingsSection
    title="Profils locaux"
    :description="`Recettes de shell de l’espace « ${store.activeWorkspace?.name ?? '—'} ». Un profil appartient à un seul espace de travail.`"
  >
    <div v-if="!store.workspaceProfiles.length" class="py-6 text-sm text-muted-foreground">
      Aucun profil local dans cet espace de travail.
    </div>

    <div
      v-for="profile in store.workspaceProfiles"
      :key="profile.id"
      class="flex items-center gap-3 py-3"
    >
      <SquareTerminal :size="16" :stroke-width="1.5" class="shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">
          {{ profile.name }}
          <span
            v-if="profile.id === store.defaultProfileId"
            class="ms-1.5 rounded border px-1 py-px align-middle text-[10px] font-normal text-muted-foreground"
          >
            par défaut
          </span>
        </p>
        <p class="truncate font-mono text-xs text-muted-foreground">
          {{ profile.executable
          }}{{ profile.workingDirectory ? ` · ${profile.workingDirectory}` : '' }}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="shrink-0 active:scale-[0.96]"
        @click="store.openTarget('profile', profile.id, { reuse: false })"
      >
        Ouvrir
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-muted-foreground active:scale-[0.96]"
        :aria-label="`Supprimer ${profile.name}`"
        :disabled="!store.nodeIdForTarget(profile.id)"
        @click="store.deleteNode(store.nodeIdForTarget(profile.id)!)"
      >
        <Trash2 :stroke-width="1.5" />
      </Button>
    </div>

    <div class="pt-4">
      <Button variant="outline" class="active:scale-[0.96]" @click="emit('add')">
        <Plus :stroke-width="1.5" />
        Ajouter un profil
      </Button>
      <p v-if="store.detectedShells.length" class="pt-2 text-xs text-muted-foreground">
        Détectés sur cette machine : {{ store.detectedShells.join(', ') }}
      </p>
    </div>
  </SettingsSection>
</template>
