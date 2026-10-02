import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/ipc/client'
import { on } from '@/ipc/events'
import type { Group, Host, Id, Mutation, VaultView } from '@/ipc/types'

const empty: VaultView = {
  groups: [],
  hosts: [],
  identities: [],
  keys: [],
  knownHosts: [],
  passwords: [],
  passphrases: [],
  secretsAvailable: false,
  effective: {},
}

/**
 * The interface's copy of the vault. Rust returns the whole view after every
 * change, so this store replaces rather than patches, and never holds secrets.
 */
export const useVault = defineStore('vault', () => {
  const view = ref<VaultView>(empty)

  const hostsById = computed(() => new Map(view.value.hosts.map((host) => [host.id, host])))

  function host(id: Id): Host | undefined {
    return hostsById.value.get(id)
  }

  function group(id: Id | null): Group | undefined {
    return id ? view.value.groups.find((candidate) => candidate.id === id) : undefined
  }

  /** Group names from the root to the host's group, for display and search. */
  function groupPath(groupId: Id | null): string[] {
    const path: string[] = []
    let cursor = group(groupId)
    while (cursor && path.length <= view.value.groups.length) {
      path.unshift(cursor.name)
      cursor = group(cursor.parentId)
    }
    return path
  }

  function describe(id: Id): string {
    const found = host(id)
    if (!found) return 'Hôte supprimé'
    const effective = view.value.effective[id]
    const user = effective?.username ? `${effective.username.value}@` : ''
    const port = effective && effective.port.value !== 22 ? `:${effective.port.value}` : ''
    return `${user}${found.address}${port}`
  }

  const recentHosts = computed(() =>
    view.value.hosts
      .filter((candidate) => candidate.lastConnectedAt)
      .sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0)),
  )

  function hasPassword(id: Id): boolean {
    return view.value.passwords.includes(id)
  }

  /** Run a vault command and adopt the view it returns. */
  async function mutate(run: () => Promise<Mutation>): Promise<Id | null> {
    const result = await run()
    view.value = result.vault
    return result.id
  }

  async function refresh() {
    view.value = await api.vault.get()
  }

  function hydrate(next: VaultView) {
    view.value = next
  }

  on('vault-changed', () => void refresh().catch(() => undefined))

  return {
    view,
    host,
    group,
    groupPath,
    describe,
    recentHosts,
    hasPassword,
    mutate,
    refresh,
    hydrate,
  }
})
