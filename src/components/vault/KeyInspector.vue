<script setup lang="ts">
import { Copy, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import { formatDate } from './format'
import IconAction from './IconAction.vue'
import InspectorLayout from './InspectorLayout.vue'
import { useKeyActions } from './useKeyActions'
import { useVaultActions } from './useVaultActions'
import VaultField from './VaultField.vue'

/** A key's public half, which is what users come here to copy. */
const props = defineProps<{ keyId: Id }>()
const vault = useVault()
const actions = useVaultActions()
const keyActions = useKeyActions()

const key = computed(() => vault.view.keys.find((item) => item.id === props.keyId))
const label = ref('')
watch(
  () => key.value?.label,
  (value) => (label.value = value ?? ''),
  { immediate: true },
)

const protection = computed(() => {
  if (!key.value?.encrypted) return 'Sans phrase de passe'
  return vault.view.passphrases.includes(props.keyId)
    ? 'Phrase de passe mémorisée'
    : 'Phrase de passe demandée à chaque connexion'
})

function rename() {
  const next = label.value.trim()
  if (!next) label.value = key.value?.label ?? ''
  else if (next !== key.value?.label) void keyActions.rename(props.keyId, next)
}
</script>

<template>
  <InspectorLayout
    v-if="key"
    :title="key.label"
    :subtitle="`${key.algorithm}, créée le ${formatDate(key.createdAt)}`"
  >
    <template #actions>
      <IconAction label="Supprimer la clé" @click="actions.deleteKey(key.id)">
        <Trash2 :stroke-width="1.5" />
      </IconAction>
    </template>
    <VaultField label="Libellé" for="key-label">
      <Input
        id="key-label"
        v-model="label"
        class="h-8 text-[13px] md:text-[13px]"
        @blur="rename"
        @keydown.enter="rename"
      />
    </VaultField>
    <VaultField label="Empreinte">
      <p class="font-mono text-xs break-all select-text">{{ key.fingerprint }}</p>
    </VaultField>
    <VaultField label="Protection">
      <p class="text-[13px]">{{ protection }}</p>
    </VaultField>
    <VaultField
      label="Clé publique"
      for="key-public"
      hint="Ajoutez-la au fichier ~/.ssh/authorized_keys des serveurs qui doivent accepter cette clé."
    >
      <textarea
        id="key-public"
        readonly
        :value="key.publicKey"
        rows="4"
        class="border-input bg-muted/40 focus-visible:ring-ring w-full resize-none rounded-md border px-2.5 py-2 font-mono text-xs break-all outline-none focus-visible:ring-2"
        @focus="($event.target as HTMLTextAreaElement).select()"
      />
    </VaultField>
    <Button
      variant="outline"
      size="sm"
      class="justify-self-start"
      @click="keyActions.copyPublicKey(key)"
    >
      <Copy :stroke-width="1.5" />
      Copier la clé publique
    </Button>
  </InspectorLayout>
</template>
