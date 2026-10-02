<script setup lang="ts">
import { computed } from 'vue'
import { TooltipProvider } from '@/components/ui/tooltip'
import GroupEditor from './GroupEditor.vue'
import HostEditor from './HostEditor.vue'
import HostList from './HostList.vue'
import IdentityEditor from './IdentityEditor.vue'
import IdentityList from './IdentityList.vue'
import KeyInspector from './KeyInspector.vue'
import KeyList from './KeyList.vue'
import KnownHostList from './KnownHostList.vue'
import { provideVaultState } from './useVaultState'
import VaultRail from './VaultRail.vue'

/**
 * The vault: sections and groups on the left, the current list in the
 * middle, and the selected item's inspector on the right when there is one.
 */
const state = provideVaultState()

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
  <TooltipProvider :delay-duration="500">
    <div class="text-foreground flex h-full min-h-0 font-sans text-[13px]">
      <VaultRail class="border-e border-border" />
      <main class="min-w-0 flex-1">
        <component :is="list" :key="state.section.value" />
      </main>
      <Transition
        enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
        enter-from-class="translate-x-2 opacity-0"
      >
        <aside
          v-if="state.inspecting.value"
          aria-label="Détails"
          class="w-[340px] shrink-0 border-s border-border"
        >
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
        </aside>
      </Transition>
    </div>
  </TooltipProvider>
</template>
