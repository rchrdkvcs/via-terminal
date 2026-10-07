<script setup lang="ts">
import { computed } from 'vue'
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
    id: `identity:${identity.id}`,
    label: `${identity.label} — ${identity.username}`,
  })),
  ...vault.view.keys.map((key) => ({ id: `key:${key.id}`, label: `Clé SSH — ${key.label}` })),
])
</script>

<template>
  <IdSelect :id="id" v-model="model" :options="options" :none="none" />
</template>
