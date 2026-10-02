<script setup lang="ts">
import { Textarea } from '@/components/ui/textarea'
import type { HostInput } from '@/ipc/types'
import IdSelect from './IdSelect.vue'
import TagInput from './TagInput.vue'
import { useVaultOptions } from './useVaultOptions'
import VaultField from './VaultField.vue'

/** Where the host is filed and what the user wants to remember about it. */
const draft = defineModel<HostInput>({ required: true })
const emit = defineEmits<{ commit: [] }>()
const options = useVaultOptions()

function move(groupId: string | null) {
  draft.value.groupId = groupId
  emit('commit')
}
</script>

<template>
  <VaultField label="Groupe" for="host-group">
    <IdSelect
      id="host-group"
      :model-value="draft.groupId"
      :options="options.groups.value"
      none="Aucun groupe"
      @update:model-value="move"
    />
  </VaultField>
  <VaultField label="Tags" for="host-tags" hint="Séparez-les par une virgule ou Entrée.">
    <TagInput id="host-tags" v-model="draft.tags" @commit="emit('commit')" />
  </VaultField>
  <VaultField label="Notes" for="host-notes">
    <Textarea
      id="host-notes"
      v-model="draft.notes"
      placeholder="Accès, contacts, particularités"
      class="min-h-20 text-[13px] md:text-[13px]"
      @blur="emit('commit')"
    />
  </VaultField>
</template>
