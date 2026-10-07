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

export const useVault = defineStore('vault', () => {
  const view = ref<VaultView>(empty)
  const pending = new Set<Promise<Id | null>>()

  const hostsById = computed(() => new Map(view.value.hosts.map((host) => [host.id, host])))

  function host(id: Id): Host | undefined {
    return hostsById.value.get(id)
  }

  function group(id: Id | null): Group | undefined {
    return id ? view.value.groups.find((candidate) => candidate.id === id) : undefined
  }

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

  function mutate(run: () => Promise<Mutation>): Promise<Id | null> {
    const operation = run().then((result) => {
      view.value = result.vault
      return result.id
    })
    pending.add(operation)
    const remove = () => pending.delete(operation)
    void operation.then(remove, remove)
    return operation
  }

  async function flush() {
    while (pending.size) {
      const results = await Promise.allSettled(pending)
      const failed = results.find((result) => result.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
    }
  }

  function isUnnamed(id: Id): boolean {
    const found = host(id)
    return Boolean(found && (!found.label || found.label === found.address))
  }

  async function rename(id: Id, label: string) {
    const found = host(id)
    if (!found) return
    await mutate(() =>
      api.vault.saveHost({
        id: found.id,
        ownCredentials: found.ownCredentials,
        groupId: found.groupId,
        label,
        address: found.address,
        overrides: found.overrides,
        keyId: found.keyId,
        tags: found.tags,
        notes: found.notes,
        password: { action: 'keep' },
      }),
    )
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
    isUnnamed,
    rename,
    mutate,
    flush,
    refresh,
    hydrate,
  }
})
