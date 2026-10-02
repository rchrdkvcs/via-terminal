<script setup lang="ts">
import { FolderPlus, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { api } from '@/ipc/client'
import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import IconAction from './IconAction.vue'
import IdSelect from './IdSelect.vue'
import { hint, identityHint, inherited } from './inherit'
import { groupInput } from './inputs'
import InspectorLayout from './InspectorLayout.vue'
import PortField from './PortField.vue'
import { flatten } from './tree'
import { useDraft } from './useDraft'
import { useGroupTree } from './useGroupTree'
import UsernameField from './UsernameField.vue'
import { useVaultOptions } from './useVaultOptions'
import VaultField from './VaultField.vue'

/** A group's name and the defaults its hosts and sub-groups inherit. */
const props = defineProps<{ groupId: Id }>()
const vault = useVault()
const tree = useGroupTree()
const options = useVaultOptions()

const { draft, error, autosave } = useDraft({
  source: () => groupInput(vault.group(props.groupId)),
  save: (input) => vault.mutate(() => api.vault.saveGroup(input)),
  validate: (input) => (input.name.trim() ? null : 'Donnez un nom au groupe.'),
})

const resolved = computed(() =>
  inherited(vault.view, draft.value.parentId, draft.value.defaults.identityId),
)
const count = computed(
  () => flatten(options.tree.value).find((node) => node.group.id === props.groupId)?.count ?? 0,
)
const identityNone = computed(() =>
  identityHint(vault.view, inherited(vault.view, draft.value.parentId).identityId),
)

function setIdentity(id: Id | null) {
  draft.value.defaults.identityId = id
  void autosave()
}
</script>

<template>
  <InspectorLayout
    :title="draft.name || 'Groupe'"
    :subtitle="count === 1 ? '1 hôte' : `${count} hôtes`"
    :error="error"
  >
    <template #actions>
      <IconAction label="Nouveau sous-groupe" @click="tree.add(groupId)">
        <FolderPlus :stroke-width="1.5" />
      </IconAction>
      <IconAction label="Supprimer le groupe" @click="tree.remove(groupId)">
        <Trash2 :stroke-width="1.5" />
      </IconAction>
    </template>
    <VaultField label="Nom" for="group-name">
      <Input
        id="group-name"
        v-model="draft.name"
        class="h-8 text-[13px] md:text-[13px]"
        @blur="autosave"
      />
    </VaultField>
    <p class="text-muted-foreground text-xs leading-snug text-pretty">
      Les hôtes de ce groupe et de ses sous-groupes reprennent ces valeurs, sauf s’ils en
      définissent d’autres.
    </p>
    <div class="grid grid-cols-2 gap-2">
      <UsernameField
        id="group-username"
        v-model="draft.defaults.username"
        :placeholder="hint(vault.view, resolved.username, 'Aucun')"
        @commit="autosave"
      />
      <PortField
        id="group-port"
        v-model="draft.defaults.port"
        :placeholder="hint(vault.view, resolved.port)"
        @commit="autosave"
      />
    </div>
    <VaultField label="Identité" for="group-identity">
      <IdSelect
        id="group-identity"
        :model-value="draft.defaults.identityId"
        :options="options.identities.value"
        :none="identityNone"
        @update:model-value="setIdentity"
      />
    </VaultField>
  </InspectorLayout>
</template>
