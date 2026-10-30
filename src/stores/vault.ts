import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/ipc/client'
import { on } from '@/ipc/events'
import type { Host, HostInput, Id, IdentityInput, Mutation, VaultView } from '@/ipc/types'
import { hostInput, identityInput } from './vault-inputs'
import { createVaultSaves, type RecordKind, type SaveOutcome } from './vault-saves'

const empty: VaultView = {
  hosts: [],
  identities: [],
  keys: [],
  knownHosts: [],
  passwords: [],
  passphrases: [],
  secretsAvailable: false,
  effective: {},
  revision: -1,
}

const savers = {
  host: (input: HostInput) => api.vault.saveHost(input),
  identity: (input: IdentityInput) => api.vault.saveIdentity(input),
} as const

const removers = {
  host: (id: Id) => api.vault.deleteHost(id),
  identity: (id: Id) => api.vault.deleteIdentity(id),
} as const

export const useVault = defineStore('vault', () => {
  const view = ref<VaultView>(empty)
  const pending = new Set<Promise<Id | null>>()

  const hostsById = computed(() => new Map(view.value.hosts.map((host) => [host.id, host])))

  function host(id: Id): Host | undefined {
    return hostsById.value.get(id)
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

  /** A reply computed before the current view never replaces it. */
  function apply(next: VaultView) {
    if (next.revision >= view.value.revision) view.value = next
  }

  function mutate(run: () => Promise<Mutation>): Promise<Id | null> {
    const operation = run().then((result) => {
      apply(result.vault)
      return result.id
    })
    pending.add(operation)
    const remove = () => pending.delete(operation)
    void operation.then(remove, remove)
    return operation
  }

  function current(kind: RecordKind, id: Id) {
    if (kind === 'host') {
      const found = host(id)
      return found && hostInput(found)
    }
    const found = view.value.identities.find((candidate) => candidate.id === id)
    return found && identityInput(found)
  }

  const saves = createVaultSaves({
    save: (kind, input) => mutate(() => savers[kind](input as never)),
    current: (kind, id) => current(kind, id) as never,
  })

  /** Every host or identity write goes through the per-record save queue. */
  function save<T extends { id: Id | null }>(kind: RecordKind, owner: object, input: T) {
    return saves.queue(kind, owner, input)
  }

  async function patched<T>(outcome: Promise<SaveOutcome<T>>): Promise<Id | null> {
    const result = await outcome
    if (!result.id && 'cause' in result) throw result.cause
    return result.id
  }

  async function remove(kind: RecordKind, id: Id): Promise<Id | null> {
    await saves.cancel(kind, id)
    return mutate(() => removers[kind](id))
  }

  async function duplicateHost(id: Id): Promise<Id | null> {
    await saves.settled('host', id)
    return mutate(() => api.vault.duplicateHost(id))
  }

  async function flush() {
    await saves.flush()
    while (pending.size) {
      const results = await Promise.allSettled(pending)
      const failed = results.find((result) => result.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
      await saves.flush()
    }
  }

  function isUnnamed(id: Id): boolean {
    const found = host(id)
    return Boolean(found && (!found.label || found.label === found.address))
  }

  async function rename(id: Id, label: string): Promise<Id | null> {
    if (!host(id)) return null
    return patched(saves.patch<HostInput>('host', id, (latest) => ({ ...latest, label })))
  }

  async function refresh() {
    apply(await api.vault.get())
  }

  function hydrate(next: VaultView) {
    apply(next)
  }

  on('vault-changed', () => void refresh().catch(() => undefined))

  return {
    view,
    host,
    describe,
    recentHosts,
    hasPassword,
    isUnnamed,
    save,
    rename,
    remove,
    duplicateHost,
    mutate,
    flush,
    refresh,
    hydrate,
  }
})
