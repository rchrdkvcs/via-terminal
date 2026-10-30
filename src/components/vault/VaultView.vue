<script setup lang="ts">
import { computed } from 'vue'
import GroupEditor from './GroupEditor.vue'
import HostEditor from './HostEditor.vue'
import HostList from './HostList.vue'
import IdentityEditor from './IdentityEditor.vue'
import IdentityList from './IdentityList.vue'
import KeyInspector from './KeyInspector.vue'
import KeyList from './KeyList.vue'
import KnownHostList from './KnownHostList.vue'
import { useVaultState } from './useVaultState'

const state = useVaultState()

const lists = {
  hosts: HostList,
  identities: IdentityList,
  keys: KeyList,
  knownHosts: KnownHostList,
}
const list = computed(() => lists[state.section.value])
const id = computed(() => state.selected.value ?? '')
const inspectorKey = computed(() => `${state.inspecting.value}:${state.selected.value ?? 'new'}`)
</script>

<template>
  <Transition
    mode="out-in"
    enter-active-class="transition-[opacity,translate] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
    :enter-from-class="
      state.inspecting.value ? 'translate-x-3 opacity-0' : '-translate-x-3 opacity-0'
    "
    leave-active-class="transition-opacity duration-100 ease-[var(--ease-out)] motion-reduce:transition-none"
    leave-to-class="opacity-0"
  >
    <div v-if="state.inspecting.value" :key="inspectorKey" class="flex min-w-0 flex-1">
      <HostEditor v-if="state.inspecting.value === 'host'" :host-id="id" />
      <HostEditor v-else-if="state.inspecting.value === 'new-host'" :host-id="null" />
      <GroupEditor v-else-if="state.inspecting.value === 'group'" :group-id="id" />
      <IdentityEditor v-else-if="state.inspecting.value === 'identity'" :identity-id="id" />
      <IdentityEditor v-else-if="state.inspecting.value === 'new-identity'" :identity-id="null" />
      <KeyInspector v-else-if="state.inspecting.value === 'key'" :key-id="id" />
    </div>
    <main v-else :key="state.section.value" class="min-w-0 flex-1">
      <component :is="list" />
    </main>
  </Transition>
</template>
