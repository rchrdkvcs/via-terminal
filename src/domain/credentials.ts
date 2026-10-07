import type { Effective, Group, HostCredential, Id, Identity, Sourced } from '@/ipc/types'

type Data = { groups: Group[]; identities: Identity[] }

export interface Inherited {
  username: Sourced<string> | null
  port: Sourced<number>
  identityId: Sourced<Id> | null
}

export type CredentialOption =
  | { kind: 'inherit' }
  | { kind: 'identity'; id: Id }
  | { kind: 'key'; id: Id }
  | null

const DEFAULT_PORT: Sourced<number> = { value: 22, from: { kind: 'default' } }

export function inherited(data: Data, groupId: Id | null): Inherited {
  let username: Sourced<string> | null = null
  let port: Sourced<number> | null = null
  let identityId: Sourced<Id> | null = null
  let cursor = groupId
  for (let depth = 0; cursor && depth < data.groups.length; depth++) {
    const group = data.groups.find((candidate) => candidate.id === cursor)
    if (!group) break
    const from = { kind: 'group', id: group.id } as const
    const { defaults } = group
    const identity = data.identities.find((candidate) => candidate.id === defaults.identityId)
    username ??= identity
      ? { value: identity.username, from: { kind: 'identity', id: identity.id } }
      : defaults.username
        ? { value: defaults.username, from }
        : null
    port ??= defaults.port ? { value: defaults.port, from } : null
    identityId ??= identity ? { value: identity.id, from } : null
    cursor = group.parentId
  }
  return { username, port: port ?? DEFAULT_PORT, identityId }
}

export function effective(
  data: Data,
  host: { groupId: Id | null; port: number | null; credential: HostCredential },
): Effective {
  const groups = inherited(data, host.groupId)
  const port: Sourced<number> = host.port
    ? { value: host.port, from: { kind: 'host' } }
    : groups.port
  const own = <T>(value: T): Sourced<T> => ({ value, from: { kind: 'host' } })
  const credential = host.credential
  let username: Sourced<string> | null = null
  let identityId: Sourced<Id> | null = null
  let keyId: Sourced<Id> | null = null
  if (credential.kind === 'inherit') {
    username = groups.username
    identityId = groups.identityId
  } else if (credential.kind === 'identity') {
    const identity = data.identities.find((candidate) => candidate.id === credential.id)
    if (identity) {
      username = { value: identity.username, from: { kind: 'identity', id: identity.id } }
      identityId = own(identity.id)
    }
  } else {
    username = credential.username ? own(credential.username) : null
    if (credential.kind === 'key') keyId = own(credential.id)
  }
  if (!keyId && identityId) {
    const identity = data.identities.find((candidate) => candidate.id === identityId.value)
    if (identity?.keyId)
      keyId = { value: identity.keyId, from: { kind: 'identity', id: identity.id } }
  }
  return { username, port, identityId, keyId }
}

export function optionId(option: CredentialOption): string | null {
  return option && (option.kind === 'inherit' ? 'inherit' : `${option.kind}:${option.id}`)
}

export function parseOption(id: string | null): CredentialOption {
  if (id === 'inherit') return { kind: 'inherit' }
  const [kind, value] = id?.split(':') ?? []
  if (value && (kind === 'identity' || kind === 'key')) return { kind, id: value }
  return null
}

/** The option shown for a credential; `null` is the username and password form. */
export function credentialOption(
  credential: HostCredential,
  canInherit: boolean,
): CredentialOption {
  if (credential.kind === 'identity' || credential.kind === 'key')
    return { kind: credential.kind, id: credential.id }
  return credential.kind === 'inherit' && canInherit ? credential : null
}

/** A newly chosen option keeps the username that was in effect when it needs one. */
export function choose(option: CredentialOption, username: string | null): HostCredential {
  if (!option) return { kind: 'password', username }
  if (option.kind === 'key') return { kind: 'key', id: option.id, username }
  return option
}

export function credentialUsername(credential: HostCredential): string | null {
  return credential.kind === 'key' || credential.kind === 'password' ? credential.username : null
}

/** Typing a username or password makes the credential the host's own. */
export function withUsername(credential: HostCredential, username: string | null): HostCredential {
  if (credential.kind === 'key') return { ...credential, username }
  if (credential.kind === 'password' || credential.kind === 'inherit')
    return { kind: 'password', username }
  return credential
}
