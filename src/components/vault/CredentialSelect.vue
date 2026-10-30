<script setup lang="ts">
import { KeyRound, UserRound } from '@lucide/vue'
import { computed } from 'vue'
import { optionId } from '@/domain/credentials'
import { useVault } from '@/stores/vault'
import IdSelect from './IdSelect.vue'

withDefaults(defineProps<{ id?: string; none?: string }>(), {
  none: 'Utilisateur et mot de passe',
})
const model = defineModel<string | null>({ required: true })
const vault = useVault()
const options = computed(() => [
  ...vault.view.identities.map((identity) => ({
    id: optionId({ kind: 'identity', id: identity.id })!,
    label: `${identity.label} — ${identity.username}`,
    icon: UserRound,
  })),
  ...vault.view.keys.map((key) => ({
    id: optionId({ kind: 'key', id: key.id })!,
    label: key.label,
    icon: KeyRound,
  })),
])
</script>

<template>
  <IdSelect :id="id" v-model="model" :options="options" :none="none" :none-icon="UserRound" />
</template>
