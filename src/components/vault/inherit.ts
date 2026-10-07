import type { Defaults, Id, Source, Sourced, VaultView } from '@/ipc/types'

type Data = Pick<VaultView, 'groups' | 'identities'>

export interface Inherited {
  username: Sourced<string> | null
  port: Sourced<number>
  identityId: Sourced<Id> | null
}

export function inherited(data: Data, groupId: Id | null, own: Id | null = null): Inherited {
  const levels: { defaults: Defaults; from: Source }[] = [
    { defaults: { username: null, port: null, identityId: own }, from: { kind: 'host' } },
  ]
  let cursor = groupId

  while (cursor && levels.length <= data.groups.length + 1) {
    const group = data.groups.find((candidate) => candidate.id === cursor)
    if (!group) break
    levels.push({ defaults: group.defaults, from: { kind: 'group', id: group.id } })
    cursor = group.parentId
  }
  let username: Sourced<string> | null = null
  let port: Sourced<number> | null = null
  let identityId: Sourced<Id> | null = null
  for (const { defaults, from } of levels) {
    const identity = data.identities.find((candidate) => candidate.id === defaults.identityId)
    if (!username && defaults.username) username = { value: defaults.username, from }
    if (!username && identity) {
      username = { value: identity.username, from: { kind: 'identity', id: identity.id } }
    }
    if (!port && defaults.port) port = { value: defaults.port, from }
    if (!identityId && identity) identityId = { value: identity.id, from }
  }
  return { username, port: port ?? { value: 22, from: { kind: 'default' } }, identityId }
}

export function sourceName(data: Data, source: Source): string {
  if (source.kind === 'default') return 'par défaut'
  if (source.kind === 'host') return 'cet élément'
  if (source.kind === 'group') {
    const group = data.groups.find((candidate) => candidate.id === source.id)
    return group ? `groupe ${group.name}` : 'groupe supprimé'
  }
  const identity = data.identities.find((candidate) => candidate.id === source.id)
  return identity ? `identité ${identity.label}` : 'identité supprimée'
}

export function identityHint(data: Data, sourced: Sourced<Id> | null): string {
  const identity = data.identities.find((candidate) => candidate.id === sourced?.value)
  if (!sourced || !identity) return 'Aucune'
  return `Héritée : ${hint(data, { value: identity.label, from: sourced.from })}`
}

export function hint<T>(data: Data, sourced: Sourced<T> | null, fallback = ''): string {
  return sourced ? `${String(sourced.value)} (${sourceName(data, sourced.from)})` : fallback
}
