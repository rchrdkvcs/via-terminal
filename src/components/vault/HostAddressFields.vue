<script setup lang="ts">
import { Input } from '@/components/ui/input'
import type { HostInput } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import { hint, type Inherited } from './inherit'
import PortField from './PortField.vue'
import UsernameField from './UsernameField.vue'
import VaultField from './VaultField.vue'

/** Where to connect: label, address, user and port, with inherited placeholders. */
defineProps<{ inherited: Inherited }>()
const draft = defineModel<HostInput>({ required: true })
const emit = defineEmits<{ commit: [] }>()
const vault = useVault()
const field = 'h-8 text-[13px] md:text-[13px]'
</script>

<template>
  <VaultField label="Libellé" for="host-label">
    <Input
      id="host-label"
      v-model="draft.label"
      :placeholder="draft.address || 'Nom affiché dans les listes'"
      :class="field"
      @blur="emit('commit')"
    />
  </VaultField>
  <VaultField label="Adresse" for="host-address">
    <Input
      id="host-address"
      v-model="draft.address"
      aria-required="true"
      placeholder="srv.example.net ou 10.0.0.5"
      autocapitalize="off"
      spellcheck="false"
      :class="field"
      @blur="emit('commit')"
    />
  </VaultField>
  <div class="grid grid-cols-2 gap-2">
    <UsernameField
      id="host-username"
      v-model="draft.overrides.username"
      :placeholder="hint(vault.view, inherited.username, 'Demandé à la connexion')"
      @commit="emit('commit')"
    />
    <PortField
      id="host-port"
      v-model="draft.overrides.port"
      :placeholder="hint(vault.view, inherited.port)"
      @commit="emit('commit')"
    />
  </div>
</template>
