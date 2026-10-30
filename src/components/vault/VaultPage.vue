<script setup lang="ts">
import { computed } from 'vue'
import { Fingerprint, KeyRound, Server, UserRound } from '@lucide/vue'
import PageShell, { type PageSection } from '@/components/page/PageShell.vue'
import { useHostName } from '@/composables/useHostName'
import { useVault } from '@/stores/vault'
import GroupEditor from './GroupEditor.vue'
import GroupTree from './GroupTree.vue'
import HostEditor from './HostEditor.vue'
import HostList from './HostList.vue'
import IdentityEditor from './IdentityEditor.vue'
import IdentityList from './IdentityList.vue'
import KeyInspector from './KeyInspector.vue'
import KeyList from './KeyList.vue'
import KnownHostList from './KnownHostList.vue'
import { provideVaultState, type Section } from './useVaultState'

const state = provideVaultState()
const vault = useVault()
const hostName = useHostName()

const sections = computed<PageSection<Section>[]>(() => [
  { id: 'hosts', label: 'Hôtes', icon: Server, count: vault.view.hosts.length },
  { id: 'identities', label: 'Identités', icon: UserRound, count: vault.view.identities.length },
  { id: 'keys', label: 'Clés', icon: KeyRound, count: vault.view.keys.length },
  {
    id: 'knownHosts',
    label: 'Empreintes connues',
    icon: Fingerprint,
    count: vault.view.knownHosts.length,
  },
])
const lists = {
  hosts: HostList,
  identities: IdentityList,
  keys: KeyList,
  knownHosts: KnownHostList,
}
const list = computed(() => lists[state.section.value])
const id = computed(() => state.selected.value ?? '')

const inspectorKey = computed(() => `${state.inspecting.value}:${state.selected.value ?? 'new'}`)

const detail = computed(() => {
  switch (state.inspecting.value) {
    case 'host':
      return hostName(id.value)
    case 'new-host':
      return 'Nouvel hôte'
    case 'group':
      return vault.group(id.value)?.name ?? 'Groupe'
    case 'identity':
      return vault.view.identities.find((item) => item.id === id.value)?.label ?? 'Identité'
    case 'new-identity':
      return 'Nouvelle identité'
    case 'key':
      return vault.view.keys.find((item) => item.id === id.value)?.label ?? 'Clé'
    default:
      return null
  }
})
</script>

<template>
  <PageShell
    v-model="state.section.value"
    title="Coffre"
    close-label="Fermer le coffre"
    :sections="sections"
    :detail="detail"
    @back="state.back()"
  >
    <template #rail>
      <GroupTree v-if="state.section.value === 'hosts'" />
    </template>
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
  </PageShell>
</template>
