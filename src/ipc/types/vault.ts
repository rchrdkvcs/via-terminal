import type { Id } from './layout'

export interface Defaults {
  username: string | null
  port: number | null
  identityId: Id | null
}

export interface Group {
  id: Id
  parentId: Id | null
  name: string
  position: number
  defaults: Defaults
}

export type HostCredential =
  | { kind: 'inherit' }
  | { kind: 'identity'; id: Id }
  | { kind: 'key'; id: Id; username: string | null }
  | { kind: 'password'; username: string | null }

export interface Host {
  id: Id
  groupId: Id | null
  label: string
  address: string
  port: number | null
  credential: HostCredential
  tags: string[]
  notes: string
  createdAt: number
  lastConnectedAt: number | null
}

export interface Identity {
  id: Id
  label: string
  username: string
  keyId: Id | null
}

export interface Key {
  id: Id
  label: string
  algorithm: string
  fingerprint: string
  publicKey: string
  encrypted: boolean
  createdAt: number
}

export interface KnownHost {
  id: Id
  address: string
  port: number
  algorithm: string
  fingerprint: string
  addedAt: number
}

export type Source =
  | { kind: 'host' }
  | { kind: 'identity'; id: Id }
  | { kind: 'group'; id: Id }
  | { kind: 'default' }

export interface Sourced<T> {
  value: T
  from: Source
}

export interface Effective {
  username: Sourced<string> | null
  port: Sourced<number>
  identityId: Sourced<Id> | null
  keyId: Sourced<Id> | null
}

export interface VaultView {
  groups: Group[]
  hosts: Host[]
  identities: Identity[]
  keys: Key[]
  knownHosts: KnownHost[]

  passwords: Id[]

  passphrases: Id[]
  secretsAvailable: boolean
  effective: Record<Id, Effective>
  revision: number
}

export type SecretUpdate =
  | { action: 'keep' }
  | { action: 'clear' }
  | { action: 'set'; value: string }

export interface HostInput {
  id: Id | null
  groupId: Id | null
  label: string
  address: string
  port: number | null
  credential: HostCredential
  tags: string[]
  notes: string
  password: SecretUpdate
}

export interface GroupInput {
  id: Id | null
  parentId: Id | null
  name: string
  defaults: Defaults
}

export interface IdentityInput {
  id: Id | null
  label: string
  username: string
  keyId: Id | null
  password: SecretUpdate
}

export interface KeyImport {
  label: string
  privateKey: string
  passphrase: string | null
  rememberPassphrase: boolean
}

export interface Mutation {
  vault: VaultView
  id: Id | null
}
