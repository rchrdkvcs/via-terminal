<script setup lang="ts">
import { KeyRound, Plus, Server, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import SettingsSection from '../SettingsSection.vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ add: [] }>()

const store = useAppStore()
</script>

<template>
  <SettingsSection
    title="Ressources SSH"
    description="Via lit votre configuration OpenSSH et ne la modifie jamais. Les clés, les phrases de passe et l’agent restent gérés par OpenSSH."
  >
    <div v-if="!store.workspaceResources.length" class="py-6 text-sm text-muted-foreground">
      Aucune ressource SSH dans cet espace de travail.
    </div>

    <div
      v-for="resource in store.workspaceResources"
      :key="resource.id"
      class="flex items-center gap-3 py-3"
    >
      <Server :size="16" :stroke-width="1.5" class="shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ resource.name }}</p>
        <p class="truncate font-mono text-xs text-muted-foreground">
          {{ store.describeTarget('resource', resource.id) }}
          <span v-if="resource.sshAlias"> · alias {{ resource.sshAlias }}</span>
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="shrink-0 active:scale-[0.96]"
        :disabled="!resource.identityId"
        @click="store.openTarget('resource', resource.id, { reuse: false })"
      >
        Connecter
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-muted-foreground active:scale-[0.96]"
        :aria-label="`Supprimer ${resource.name}`"
        :disabled="!store.nodeIdForTarget(resource.id)"
        @click="store.deleteNode(store.nodeIdForTarget(resource.id)!)"
      >
        <Trash2 :stroke-width="1.5" />
      </Button>
    </div>

    <div class="pt-4">
      <Button variant="outline" class="active:scale-[0.96]" @click="emit('add')">
        <Plus :stroke-width="1.5" />
        Ajouter une ressource
      </Button>
    </div>

    <div class="pt-6">
      <h3 class="pb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Identités
      </h3>
      <p v-if="!store.workspaceIdentities.length" class="text-sm text-muted-foreground">
        Aucune identité. Une identité est créée avec chaque ressource.
      </p>
      <div
        v-for="identity in store.workspaceIdentities"
        :key="identity.id"
        class="flex items-center gap-3 py-2"
      >
        <KeyRound :size="16" :stroke-width="1.5" class="shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm">{{ identity.username }}</p>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ identity.identityFile ?? 'Clé résolue par OpenSSH' }}
          </p>
        </div>
        <span class="shrink-0 text-xs text-muted-foreground">
          {{ store.workspaceResources.filter((item) => item.identityId === identity.id).length }}
          ressource(s)
        </span>
      </div>
      <p class="pt-2 text-xs text-muted-foreground">
        Aucun mot de passe n’est stocké, journalisé ni exporté.
      </p>
    </div>
  </SettingsSection>
</template>
