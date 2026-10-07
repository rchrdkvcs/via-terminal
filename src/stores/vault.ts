import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/ipc/client'
import { on } from '@/ipc/events'
import type {
  Group,
  GroupInput,
  Host,
  HostInput,
  Id,
  IdentityInput,
  Mutation,
  VaultView,
} from '@/ipc/types'
import { groupInput, hostInput, identityInput } from './vault-inputs'
import { createVaultSaves, type RecordKind, type SaveOutcome } from './vault-saves'

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
  revision: -1,
}

const savers = {
  host: (input: HostInput) => api.vault.saveHost(input),
  group: (input: GroupInput) => api.vault.saveGroup(input),
  identity: (input: IdentityInput) => api.vault.saveIdentity(input),
} as const

const removers = {
  host: (id: Id) => api.vault.deleteHost(id),
  group: (id: Id) => api.vault.deleteGroup(id),
  identity: (id: Id) => api.vault.deleteIdentity(id),
} as const

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
    if (kind === 'group') {
      const found = group(id)
      return found && groupInput(found)
    }
    const found = view.value.identities.find((candidate) => candidate.id === id)
    return found && identityInput(found)
  }

  const saves = createVaultSaves({
    save: (kind, input) => mutate(() => savers[kind](input as never)),
    current: (kind, id) => current(kind, id) as never,
  })

  /** Every host, group or identity write goes through the per-record save queue. */
  function save<T extends { id: Id | null }>(kind: RecordKind, owner: object, input: T) {
    return saves.queue(kind, owner, input)
  }

  async function patched<T>(outcome: Promise<SaveOutcome<T>>): Promise<Id | null> {
    const result = await outcome
    if (!result.id && 'cause' in result) throw result.cause
    return result.id
  }

  function createGroup(parentId: Id | null): Promise<Id | null> {
    const defaults = { username: null, port: null, identityId: null }
    return patched(save('group', {}, { id: null, parentId, name: 'Nouveau groupe', defaults }))
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

  async function renameGroup(id: Id, name: string): Promise<Id | null> {
    if (!group(id)) return null
    return patched(saves.patch<GroupInput>('group', id, (latest) => ({ ...latest, name })))
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
    group,
    groupPath,
    describe,
    recentHosts,
    hasPassword,
    isUnnamed,
    save,
    rename,
    renameGroup,
    createGroup,
    remove,
    duplicateHost,
    mutate,
    flush,
    refresh,
    hydrate,
  }
})
