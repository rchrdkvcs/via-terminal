<script setup lang="ts">
import { Copy, Pencil, Plus, Server, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Input } from '@/components/ui/input'
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
import { useAppStore } from '@/stores/app'

import type { NewTabTarget, SshConfigurationRequest } from './types'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{
  configure: [request: SshConfigurationRequest]
  open: [target: NewTabTarget]
  remove: [id: string]
}>()

const store = useAppStore()
const search = ref('')
const filteredResources = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return store.workspaceResources.filter((resource) =>
    `${resource.name} ${store.describeTarget('resource', resource.id)}`
      .toLocaleLowerCase()
      .includes(query),
  )
})
</script>

<template>
  <div>
    <Input
      v-if="store.workspaceResources.length"
      v-model="search"
      aria-label="Rechercher une connexion SSH"
      placeholder="Rechercher par nom, hôte ou utilisateur…"
      class="mb-4"
    />
    <p
      v-if="store.workspaceResources.length && !filteredResources.length"
      class="py-4 text-sm text-muted-foreground"
    >
      Aucune connexion correspondante.
    </p>
    <Empty v-if="!store.workspaceResources.length" class="border-0 py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Server /></EmptyMedia>
        <EmptyTitle>Aucune connexion SSH</EmptyTitle>
        <EmptyDescription>Enregistrez une connexion pour ouvrir un onglet SSH.</EmptyDescription>
      </EmptyHeader>
    </Empty>

    <Item v-for="resource in filteredResources" :key="resource.id" size="sm">
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
          size="icon-sm"
          :aria-label="`Modifier ${resource.name}`"
          :disabled="busy"
          @click="emit('configure', { id: resource.id, duplicate: false })"
          ><Pencil :stroke-width="1.5"
        /></Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="`Dupliquer ${resource.name}`"
          :disabled="busy"
          @click="emit('configure', { id: resource.id, duplicate: true })"
          ><Copy :stroke-width="1.5"
        /></Button>
        <Button
          variant="ghost"
          size="sm"
          class="ms-7 shrink-0 active:scale-[0.96] sm:ms-0"
          :disabled="busy || !resource.identityId"
          @click="emit('open', { kind: 'resource', id: resource.id })"
        >
          Ouvrir
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="shrink-0 text-muted-foreground active:scale-[0.96]"
          :aria-label="`Supprimer ${resource.name}`"
          :disabled="busy || !store.nodeIdForTarget(resource.id)"
          @click="emit('remove', store.nodeIdForTarget(resource.id)!)"
        >
          <Trash2 :stroke-width="1.5" />
        </Button>
      </ItemActions>
    </Item>

    <div class="pt-4">
      <Button
        variant="outline"
        class="active:scale-[0.96]"
        :disabled="busy"
        @click="emit('configure', { id: null, duplicate: false })"
      >
        <Plus :stroke-width="1.5" />
        Ajouter une connexion
      </Button>
    </div>

    <p class="pt-4 text-xs text-muted-foreground">
      Connexions enregistrées sur cet appareil, dans cet espace de travail.
    </p>
  </div>
</template>
