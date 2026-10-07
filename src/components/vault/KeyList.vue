<script setup lang="ts">
import { Copy, FileUp, Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import { formatDate, truncateMiddle } from './format'
import IconAction from './IconAction.vue'
import InlineRename from './InlineRename.vue'
import KeyGenerateForm from './KeyGenerateForm.vue'
import KeyImportDialog from './KeyImportDialog.vue'
import { useKeyActions } from './useKeyActions'
import { useVaultActions } from './useVaultActions'
import { useVaultState } from './useVaultState'
import VaultEmpty from './VaultEmpty.vue'
import VaultListPane from './VaultListPane.vue'
import VaultRow from './VaultRow.vue'

const vault = useVault()
const state = useVaultState()
const actions = useVaultActions()
const keyActions = useKeyActions()
const generating = ref(false)
const importing = ref(false)

const keys = computed(() => [...vault.view.keys].sort((a, b) => b.createdAt - a.createdAt))
const ids = computed(() => keys.value.map((key) => key.id))

function added(id: Id | null) {
  generating.value = false
  if (id) state.selected.value = id
}

async function renamed(id: Id, label: string | null) {
  state.renaming.value = null
  await keyActions.rename(id, label)
}
</script>

<template>
  <VaultListPane
    title="Clés"
    :ids="ids"
    :selected="state.selected.value"
    @select="state.selected.value = $event"
    @activate="state.renaming.value = $event"
    @remove="actions.deleteKey"
  >
    <template #actions>
      <Button variant="outline" size="sm" class="h-8" @click="importing = true">
        <FileUp :stroke-width="1.5" />
        Importer
      </Button>
      <Button size="sm" class="h-8" @click="generating = true">
        <Plus :stroke-width="1.5" />
        Générer une clé
      </Button>
    </template>
    <template #before>
      <KeyGenerateForm v-if="generating" @done="added" />
    </template>
    <template #default="{ tabbable }">
      <VaultRow
        v-for="key in keys"
        :id="key.id"
        :key="key.id"
        :selected="key.id === state.selected.value"
        :tabbable="tabbable(key.id)"
        @select="state.selected.value = key.id"
        @activate="state.renaming.value = key.id"
      >
        <div class="min-w-0 flex-1">
          <InlineRename
            v-if="state.renaming.value === key.id"
            :value="key.label"
            label="Nouveau libellé de la clé"
            @done="renamed(key.id, $event)"
          />
          <div v-else class="truncate font-medium">{{ key.label }}</div>
          <div class="text-muted-foreground flex min-w-0 gap-2 text-xs">
            <span class="shrink-0">{{ key.algorithm }}</span>
            <span class="truncate font-mono" :title="key.fingerprint">{{
              truncateMiddle(key.fingerprint, 30)
            }}</span>
          </div>
        </div>
        <span class="text-muted-foreground shrink-0 text-xs">{{ formatDate(key.createdAt) }}</span>
        <template #actions>
          <IconAction
            label="Copier la clé publique"
            tabindex="-1"
            @click.stop="keyActions.copyPublicKey(key)"
          >
            <Copy :stroke-width="1.5" />
          </IconAction>
        </template>
      </VaultRow>
    </template>
    <template #empty>
      <VaultEmpty
        title="Aucune clé"
        description="Générez une clé Ed25519 et ajoutez sa clé publique à vos serveurs, ou importez une clé existante."
      >
        <Button size="sm" variant="outline" @click="importing = true">Importer</Button>
        <Button size="sm" @click="generating = true">Générer une clé</Button>
      </VaultEmpty>
    </template>
  </VaultListPane>
  <KeyImportDialog v-model:open="importing" @imported="state.selected.value = $event" />
</template>
