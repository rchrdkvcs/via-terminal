<script setup lang="ts">
import { Fingerprint, KeyRound, Server, UserRound } from '@lucide/vue'
import { computed } from 'vue'
import { useVault } from '@/stores/vault'
import GroupTree from './GroupTree.vue'
import { type Section, useVaultState } from './useVaultState'

/** The vault's own navigation: its four sections, then the group tree for hosts. */
const vault = useVault()
const state = useVaultState()

const sections = computed(() => [
  { id: 'hosts' as Section, label: 'Hôtes', icon: Server, count: vault.view.hosts.length },
  {
    id: 'identities' as Section,
    label: 'Identités',
    icon: UserRound,
    count: vault.view.identities.length,
  },
  { id: 'keys' as Section, label: 'Clés', icon: KeyRound, count: vault.view.keys.length },
  {
    id: 'knownHosts' as Section,
    label: 'Empreintes connues',
    icon: Fingerprint,
    count: vault.view.knownHosts.length,
  },
])
</script>

<template>
  <nav
    aria-label="Coffre"
    class="flex h-full w-[220px] shrink-0 flex-col gap-4 overflow-y-auto p-2 pt-3"
  >
    <div class="grid gap-0.5">
      <h1 class="text-muted-foreground px-2.5 pb-1 text-xs">Coffre</h1>
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="focus-visible:ring-ring flex h-8 items-center gap-2 rounded-md px-2.5 text-start text-[13px] outline-none focus-visible:ring-2"
        :class="
          state.section.value === section.id
            ? 'bg-row-selected shadow-row font-medium'
            : 'hover:bg-row-hover'
        "
        :aria-current="state.section.value === section.id ? 'page' : undefined"
        @click="state.section.value = section.id"
      >
        <component
          :is="section.icon"
          class="text-muted-foreground size-3.5 shrink-0"
          :stroke-width="1.5"
          aria-hidden="true"
        />
        <span class="flex-1 truncate">{{ section.label }}</span>
        <span class="text-muted-foreground text-xs font-normal tabular-nums">{{
          section.count
        }}</span>
      </button>
    </div>
    <GroupTree v-if="state.section.value === 'hosts'" />
  </nav>
</template>
