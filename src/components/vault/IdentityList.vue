<script setup lang="ts">
import { KeyRound, LockKeyhole, Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useVault } from '@/stores/vault'
import { normalize } from './search'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'
import VaultEmpty from './VaultEmpty.vue'
import VaultListPane from './VaultListPane.vue'
import VaultRow from './VaultRow.vue'

/** Identities with their username and the credential they bring. */
const vault = useVault()
const state = useVaultState()
const actions = useVaultActions()
const query = ref('')

const identities = computed(() => {
  const words = normalize(query.value).split(/\s+/).filter(Boolean)
  return vault.view.identities
    .filter((identity) => {
      const text = normalize(`${identity.label}\n${identity.username}`)
      return words.every((word) => text.includes(word))
    })
    .sort((a, b) => a.label.localeCompare(b.label))
})
const ids = computed(() => identities.value.map((identity) => identity.id))
const keyLabel = (id: string | null) => vault.view.keys.find((key) => key.id === id)?.label

/** Enter on an identity moves into its editor, the way Enter on a host connects. */
function focusEditor() {
  document.getElementById('identity-label')?.focus()
}
</script>

<template>
  <VaultListPane
    v-model:query="query"
    title="Identités"
    search-label="Rechercher une identité"
    :ids="ids"
    :selected="state.selected.value"
    @select="state.selected.value = $event"
    @activate="focusEditor"
    @remove="actions.deleteIdentity"
  >
    <template #actions>
      <Button size="sm" class="h-8" @click="state.startCreating()">
        <Plus :stroke-width="1.5" />
        Nouvelle identité
      </Button>
    </template>
    <template #default="{ tabbable }">
      <VaultRow
        v-for="identity in identities"
        :id="identity.id"
        :key="identity.id"
        :selected="identity.id === state.selected.value"
        :tabbable="tabbable(identity.id)"
        @select="state.selected.value = identity.id"
      >
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium">{{ identity.label }}</div>
          <div class="text-muted-foreground truncate text-xs">{{ identity.username }}</div>
        </div>
        <span
          v-if="keyLabel(identity.keyId)"
          class="text-muted-foreground flex items-center gap-1 text-xs"
        >
          <KeyRound class="size-3.5" :stroke-width="1.5" aria-hidden="true" />
          {{ keyLabel(identity.keyId) }}
        </span>
        <LockKeyhole
          v-if="vault.hasPassword(identity.id)"
          class="text-muted-foreground size-3.5 shrink-0"
          :stroke-width="1.5"
          role="img"
          aria-label="Mot de passe enregistré"
        />
      </VaultRow>
    </template>
    <template #empty>
      <VaultEmpty
        :title="
          query.trim() ? `Aucune identité ne correspond à « ${query.trim()} »` : 'Aucune identité'
        "
        description="Une identité regroupe un utilisateur et sa clé ou son mot de passe, pour les réutiliser sur plusieurs hôtes ou groupes."
      >
        <Button v-if="!query.trim()" size="sm" variant="outline" @click="state.startCreating()">
          Créer une identité
        </Button>
      </VaultEmpty>
    </template>
  </VaultListPane>
</template>
