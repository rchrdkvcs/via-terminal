import type { Effective, HostCredential, Id, Identity, Sourced } from '@/ipc/types'

type Data = { identities: Identity[] }

export type CredentialOption = { kind: 'identity'; id: Id } | { kind: 'key'; id: Id } | null

const DEFAULT_PORT: Sourced<number> = { value: 22, from: { kind: 'default' } }

export function effective(
  data: Data,
  host: { port: number | null; credential: HostCredential },
): Effective {
  const own = <T>(value: T): Sourced<T> => ({ value, from: { kind: 'host' } })
  const port = host.port ? own(host.port) : DEFAULT_PORT
  const credential = host.credential
  if (credential.kind !== 'identity') {
    const username = credential.username ? own(credential.username) : null
    const keyId = credential.kind === 'key' ? own(credential.id) : null
    return { username, port, identityId: null, keyId }
  }
  const identity = data.identities.find((candidate) => candidate.id === credential.id)
  if (!identity) return { username: null, port, identityId: null, keyId: null }
  const from = { kind: 'identity', id: identity.id } as const
  return {
    username: { value: identity.username, from },
    port,
    identityId: own(identity.id),
    keyId: identity.keyId ? { value: identity.keyId, from } : null,
  }
}

export function optionId(option: CredentialOption): string | null {
  return option && `${option.kind}:${option.id}`
}

export function parseOption(id: string | null): CredentialOption {
  const [kind, value] = id?.split(':') ?? []
  if (value && (kind === 'identity' || kind === 'key')) return { kind, id: value }
  return null
}

/** The option shown for a credential; `null` is the username and password form. */
export function credentialOption(credential: HostCredential): CredentialOption {
  if (credential.kind === 'identity' || credential.kind === 'key')
    return { kind: credential.kind, id: credential.id }
  return null
}

/** A newly chosen option keeps the username that was in effect when it needs one. */
export function choose(option: CredentialOption, username: string | null): HostCredential {
  if (!option) return { kind: 'password', username }
  if (option.kind === 'key') return { kind: 'key', id: option.id, username }
  return option
}

export function credentialUsername(credential: HostCredential): string | null {
  return credential.kind === 'identity' ? null : credential.username
}

export function withUsername(credential: HostCredential, username: string | null): HostCredential {
  if (credential.kind === 'identity') return credential
  return { ...credential, username }
}
