<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useVault } from '@/stores/vault'
import HostRow from './HostRow.vue'
import { matches } from './search'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'
import VaultEmpty from './VaultEmpty.vue'
import VaultListPane from './VaultListPane.vue'

const vault = useVault()
const kbd = useShortcutLabel()
const state = useVaultState()
const actions = useVaultActions()
const query = ref('')

const hosts = computed(() =>
  vault.view.hosts
    .filter((host) =>
      matches(
        { host, username: vault.view.effective[host.id]?.username?.value ?? null },
        query.value,
      ),
    )
    .sort((a, b) => a.label.localeCompare(b.label)),
)
const ids = computed(() => hosts.value.map((host) => host.id))

const empty = computed(() => {
  if (query.value.trim()) {
    return {
      title: `Aucun hôte ne correspond à « ${query.value.trim()} »`,
      description: 'La recherche porte sur le libellé, l’adresse, l’utilisateur et les tags.',
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
    title="Tous les hôtes"
    description="Les serveurs SSH où vous vous connectez. Cliquez sur un hôte pour le modifier, Entrée pour vous y connecter."
    search-label="Rechercher un hôte"
    :ids="ids"
    @activate="actions.connect"
    @remove="actions.deleteHost"
  >
    <template #actions>
      <Button @click="state.startCreating()">
        <Plus :stroke-width="1.5" />
        Nouvel hôte
      </Button>
    </template>
    <template #default="{ tabbable, current }">
      <HostRow
        v-for="host in hosts"
        :key="host.id"
        :host="host"
        :current="current(host.id)"
        :tabbable="tabbable(host.id)"
        @open="state.selected.value = host.id"
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
