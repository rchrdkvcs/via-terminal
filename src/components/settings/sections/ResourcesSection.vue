<script setup lang="ts">
import { KeyRound, Plus, Server, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
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
    <Empty v-if="!store.workspaceResources.length" class="border-0 py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Server /></EmptyMedia>
        <EmptyTitle>Aucune ressource SSH</EmptyTitle>
        <EmptyDescription
          >Ajoutez une ressource pour vous connecter depuis cet espace.</EmptyDescription
        >
      </EmptyHeader>
    </Empty>

    <Item v-for="resource in store.workspaceResources" :key="resource.id" size="sm">
      <ItemMedia><Server :size="16" :stroke-width="1.5" /></ItemMedia>
      <ItemContent>
        <ItemTitle>{{ resource.name }}</ItemTitle>
        <ItemDescription class="truncate font-mono">
          {{ store.describeTarget('resource', resource.id) }}
          <Badge v-if="resource.sshAlias" variant="secondary">{{ resource.sshAlias }}</Badge>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="ghost"
          size="sm"
          class="ms-7 shrink-0 active:scale-[0.96] sm:ms-0"
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
          @click="store.requestNodeDelete(store.nodeIdForTarget(resource.id)!)"
        >
          <Trash2 :stroke-width="1.5" />
        </Button>
      </ItemActions>
    </Item>

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
      <Empty v-if="!store.workspaceIdentities.length" class="border-0 py-4">
        <EmptyDescription
          >Aucune identité. Une identité est créée avec chaque ressource.</EmptyDescription
        >
      </Empty>
      <Item v-for="identity in store.workspaceIdentities" :key="identity.id" size="sm">
        <ItemMedia><KeyRound :size="16" :stroke-width="1.5" /></ItemMedia>
        <ItemContent>
          <ItemTitle>{{ identity.username }}</ItemTitle>
          <ItemDescription class="truncate font-mono">
            {{ identity.identityFile ?? 'Clé résolue par OpenSSH' }}
          </ItemDescription>
        </ItemContent>
        <Badge variant="secondary" class="shrink-0">
          {{ store.workspaceResources.filter((item) => item.identityId === identity.id).length }}
          ressource(s)
        </Badge>
      </Item>
      <p class="pt-2 text-xs text-muted-foreground">
        Aucun mot de passe n’est stocké, journalisé ni exporté.
      </p>
    </div>
  </SettingsSection>
</template>
