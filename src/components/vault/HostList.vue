<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useVault } from '@/stores/vault'
import HostRow from './HostRow.vue'
import { matches } from './search'
import { subtree } from './tree'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'
import VaultEmpty from './VaultEmpty.vue'
import VaultListPane from './VaultListPane.vue'

const vault = useVault()
const kbd = useShortcutLabel()
const state = useVaultState()
const actions = useVaultActions()
const query = ref('')

const scopeGroup = computed(() => vault.group(state.scope.value))
const inScope = computed(() => {
  const groups = scopeGroup.value ? subtree(vault.view.groups, scopeGroup.value.id) : null
  return vault.view.hosts.filter((host) => !groups || (host.groupId && groups.has(host.groupId)))
})
const hosts = computed(() =>
  inScope.value
    .filter((host) =>
      matches(
        {
          host,
          username: vault.view.effective[host.id]?.username?.value ?? null,
          groupPath: vault.groupPath(host.groupId),
        },
        query.value,
      ),
    )
    .sort((a, b) => a.label.localeCompare(b.label)),
)
const ids = computed(() => hosts.value.map((host) => host.id))

watch(
  () => state.selected.value,
  (id) => {
    const host = id ? vault.host(id) : undefined
    if (host && !inScope.value.includes(host)) state.scope.value = null
  },
  { immediate: true },
)

const empty = computed(() => {
  if (query.value.trim()) {
    return {
      title: `Aucun hôte ne correspond à « ${query.value.trim()} »`,
      description:
        'La recherche porte sur le libellé, l’adresse, l’utilisateur, les tags et le groupe.',
    }
  }
  if (scopeGroup.value) {
    return {
      title: 'Ce groupe est vide',
      description:
        'Ajoutez un hôte ici, ou choisissez ce groupe dans le champ Groupe d’un hôte existant.',
    }
  }
  return {
    title: 'Aucun hôte',
    description: `Ajoutez une adresse, ou tapez utilisateur@serveur dans la barre de commande (${kbd('newTab')}).`,
  }
})
</script>

<template>
  <VaultListPane
    v-model:query="query"
    :title="scopeGroup?.name ?? 'Tous les hôtes'"
    search-label="Rechercher un hôte"
    :ids="ids"
    :selected="state.selected.value"
    @select="state.selected.value = $event"
    @activate="actions.connect"
    @remove="actions.deleteHost"
  >
    <template #actions>
      <Button size="sm" class="h-8" @click="state.startCreating()">
        <Plus :stroke-width="1.5" />
        Nouvel hôte
      </Button>
    </template>
    <template #default="{ tabbable }">
      <HostRow
        v-for="host in hosts"
        :key="host.id"
        :host="host"
        :selected="host.id === state.selected.value"
        :tabbable="tabbable(host.id)"
        @select="state.selected.value = host.id"
      />
    </template>
    <template #empty>
      <VaultEmpty :title="empty.title" :description="empty.description">
        <Button v-if="!query.trim()" size="sm" variant="outline" @click="state.startCreating()">
          Ajouter un hôte
        </Button>
      </VaultEmpty>
    </template>
  </VaultListPane>
</template>
