<script setup lang="ts">
import { Textarea } from '@/components/ui/textarea'
import type { HostInput } from '@/ipc/types'
import TagInput from './TagInput.vue'
import VaultField from './VaultField.vue'

const draft = defineModel<HostInput>({ required: true })
const emit = defineEmits<{ commit: [] }>()
</script>

<template>
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
