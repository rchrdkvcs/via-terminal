<script setup lang="ts">
import { computed } from 'vue'
import { optionId } from '@/domain/credentials'
import { useVault } from '@/stores/vault'
import IdSelect from './IdSelect.vue'

const props = withDefaults(defineProps<{ id?: string; none?: string; inherit?: string }>(), {
  none: 'Utilisateur et mot de passe',
})
const model = defineModel<string | null>({ required: true })
const vault = useVault()
const options = computed(() => [
  ...(props.inherit ? [{ id: 'inherit', label: props.inherit }] : []),
  ...vault.view.identities.map((identity) => ({
    id: optionId({ kind: 'identity', id: identity.id })!,
    label: `${identity.label} — ${identity.username}`,
  })),
  ...vault.view.keys.map((key) => ({
    id: optionId({ kind: 'key', id: key.id })!,
    label: `Clé SSH — ${key.label}`,
  })),
])
</script>

<template>
  <IdSelect :id="id" v-model="model" :options="options" :none="none" />
</template>
