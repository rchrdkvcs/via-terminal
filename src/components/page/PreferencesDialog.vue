<script setup lang="ts">
import { computed } from 'vue'
import {
  Fingerprint,
  Keyboard,
  KeyRound,
  Palette,
  Server,
  Settings2,
  Terminal,
  UserRound,
} from '@lucide/vue'
import PageShell, { type PageSection } from '@/components/page/PageShell.vue'
import SettingsView from '@/components/settings/SettingsView.vue'
import GroupTree from '@/components/vault/GroupTree.vue'
import { provideVaultState, type Section as VaultSection } from '@/components/vault/useVaultState'
import VaultView from '@/components/vault/VaultView.vue'
import { useUi, type SettingsSection } from '@/stores/ui'
import { useVault } from '@/stores/vault'

type Section = SettingsSection | VaultSection

const ui = useUi()
const vault = useVault()
const state = provideVaultState()

const settingsIds: SettingsSection[] = ['general', 'appearance', 'terminal', 'shortcuts']
const isSettings = (id: Section): id is SettingsSection =>
  settingsIds.includes(id as SettingsSection)

const sections = computed<PageSection<Section>[]>(() => [
  { group: 'Réglages', id: 'general', label: 'Général', icon: Settings2 },
  { group: 'Réglages', id: 'appearance', label: 'Apparence', icon: Palette },
  { group: 'Réglages', id: 'terminal', label: 'Terminal', icon: Terminal },
  { group: 'Réglages', id: 'shortcuts', label: 'Raccourcis', icon: Keyboard },
  { group: 'Coffre', id: 'hosts', label: 'Hôtes', icon: Server, count: vault.view.hosts.length },
  {
    group: 'Coffre',
    id: 'identities',
    label: 'Identités',
    icon: UserRound,
    count: vault.view.identities.length,
  },
  { group: 'Coffre', id: 'keys', label: 'Clés', icon: KeyRound, count: vault.view.keys.length },
  {
    group: 'Coffre',
    id: 'knownHosts',
    label: 'Empreintes connues',
    icon: Fingerprint,
    count: vault.view.knownHosts.length,
  },
])

/** One dialog for both: the route only says which half of the rail is open. */
const current = computed<Section>({
  get: () => (ui.route === 'settings' ? ui.settingsSection : state.section.value),
  set: (id) => {
    if (isSettings(id)) {
      ui.settingsSection = id
      ui.route = 'settings'
    } else {
      state.section.value = id
      ui.route = 'vault'
    }
  },
})
const label = computed(() => sections.value.find((item) => item.id === current.value)?.label ?? '')
const scopeName = computed(() => vault.group(state.scope.value)?.name ?? null)
/** An opened item, or else the group the host list is narrowed to. */
const detail = computed(() =>
  ui.route === 'vault'
    ? (state.detail.value ?? (current.value === 'hosts' ? scopeName.value : null))
    : null,
)

function back() {
  if (state.inspecting.value) state.back()
  else state.scope.value = null
}
</script>

<template>
  <PageShell
    v-model="current"
    title="Réglages et coffre"
    close-label="Fermer"
    :sections="sections"
    :detail="detail"
    :scoped="current === 'hosts' && scopeName !== null"
    @back="back"
  >
    <template #rail>
      <div v-if="current === 'hosts'" class="ps-4 pt-1 pb-2">
        <GroupTree />
      </div>
    </template>
    <SettingsView v-if="isSettings(current)" :section="current" :label="label" />
    <VaultView v-else />
  </PageShell>
</template>
