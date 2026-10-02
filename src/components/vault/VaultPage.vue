<script setup lang="ts">
import { computed } from 'vue'
import { Fingerprint, KeyRound, Server, UserRound } from '@lucide/vue'
import Inspector from '@/components/page/Inspector.vue'
import PageShell, { type PageSection } from '@/components/page/PageShell.vue'
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

/**
 * The vault: sections and groups in the rail, the current list in the
 * middle, and the selected item's inspector floating on the right.
 */
const state = provideVaultState()
const vault = useVault()

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
/** Remounting per item gives every editor a fresh draft and focus order. */
const inspectorKey = computed(() => `${state.inspecting.value}:${state.selected.value ?? 'new'}`)
</script>

<template>
  <PageShell
    v-model="state.section.value"
    title="Coffre"
    close-label="Fermer le coffre"
    :sections="sections"
  >
    <template #rail>
      <GroupTree v-if="state.section.value === 'hosts'" />
    </template>
    <main class="min-w-[320px] flex-1">
      <component :is="list" :key="state.section.value" />
    </main>
    <Transition
      enter-active-class="transition-[opacity,translate] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
      enter-from-class="translate-x-3 opacity-0"
      leave-active-class="transition-[opacity,translate] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none"
      leave-to-class="translate-x-3 opacity-0"
    >
      <Inspector v-if="state.inspecting.value" label="Détails">
        <div :key="inspectorKey" class="contents">
          <HostEditor v-if="state.inspecting.value === 'host'" :host-id="id" />
          <HostEditor v-else-if="state.inspecting.value === 'new-host'" :host-id="null" />
          <GroupEditor v-else-if="state.inspecting.value === 'group'" :group-id="id" />
          <IdentityEditor v-else-if="state.inspecting.value === 'identity'" :identity-id="id" />
          <IdentityEditor
            v-else-if="state.inspecting.value === 'new-identity'"
            :identity-id="null"
          />
          <KeyInspector v-else-if="state.inspecting.value === 'key'" :key-id="id" />
        </div>
      </Inspector>
    </Transition>
  </PageShell>
</template>
