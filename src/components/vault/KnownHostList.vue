<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useVault } from '@/stores/vault'
import { formatDate, truncateMiddle } from './format'
import IconAction from './IconAction.vue'
import { normalize } from './search'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'
import VaultEmpty from './VaultEmpty.vue'
import VaultListPane from './VaultListPane.vue'
import VaultRow from './VaultRow.vue'

const vault = useVault()
const state = useVaultState()
const actions = useVaultActions()
const query = ref('')

const known = computed(() => {
  const words = normalize(query.value).split(/\s+/).filter(Boolean)
  return vault.view.knownHosts
    .filter((item) =>
      words.every((word) => normalize(`${item.address}:${item.port}`).includes(word)),
    )
    .sort((a, b) => a.address.localeCompare(b.address) || a.port - b.port)
})
const ids = computed(() => known.value.map((item) => item.id))
</script>

<template>
  <VaultListPane
    v-model:query="query"
    title="Empreintes connues"
    search-label="Rechercher un serveur"
    :ids="ids"
    :selected="state.selected.value"
    @select="state.selected.value = $event"
    @remove="actions.deleteKnownHost"
  >
    <template #default="{ tabbable }">
      <VaultRow
        v-for="item in known"
        :id="item.id"
        :key="item.id"
        :selected="item.id === state.selected.value"
        :tabbable="tabbable(item.id)"
        @select="state.selected.value = item.id"
      >
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium">{{ item.address }}:{{ item.port }}</div>
          <div class="text-muted-foreground flex min-w-0 gap-2 text-xs">
            <span class="shrink-0">{{ item.algorithm }}</span>
            <span class="truncate font-mono select-text" :title="item.fingerprint">
              {{ truncateMiddle(item.fingerprint, 36) }}
            </span>
          </div>
        </div>
        <span class="text-muted-foreground shrink-0 text-xs"
          >Ajoutée le {{ formatDate(item.addedAt) }}</span
        >
        <template #actions>
          <IconAction
            label="Oublier cette empreinte"
            tabindex="-1"
            @click.stop="actions.deleteKnownHost(item.id)"
          >
            <Trash2 :stroke-width="1.5" />
          </IconAction>
        </template>
      </VaultRow>
    </template>
    <template #empty>
      <VaultEmpty
        :title="
          query.trim()
            ? `Aucun serveur ne correspond à « ${query.trim()} »`
            : 'Aucune empreinte connue'
        "
        description="Quand vous faites confiance à un serveur lors d’une première connexion, son empreinte apparaît ici. Via vérifie ensuite qu’elle ne change pas."
      />
    </template>
  </VaultListPane>
</template>
