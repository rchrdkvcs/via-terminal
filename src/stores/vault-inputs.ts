import type { Group, GroupInput, Host, HostInput, Id, Identity, IdentityInput } from '@/ipc/types'

const KEEP = { action: 'keep' } as const

export function hostInput(host: Host | undefined, groupId: Id | null = null): HostInput {
  if (!host) {
    return {
      id: null,
      groupId,
      label: '',
      address: '',
      overrides: { username: null, port: null, identityId: null },
      keyId: null,
      tags: [],
      notes: '',
      password: KEEP,
    }
  }
  return {
    id: host.id,
    ownCredentials: host.ownCredentials,
    groupId: host.groupId,
    label: host.label === host.address ? '' : host.label,
    address: host.address,
    overrides: { ...host.overrides },
    keyId: host.keyId,
    tags: [...host.tags],
    notes: host.notes,
    password: KEEP,
  }
}

export function groupInput(group: Group | undefined): GroupInput {
  return {
    id: group?.id ?? null,
    parentId: group?.parentId ?? null,
    name: group?.name ?? '',
    defaults: { username: null, port: null, identityId: null, ...group?.defaults },
  }
}

export function identityInput(identity: Identity | undefined): IdentityInput {
  return {
    id: identity?.id ?? null,
    label: identity && identity.label !== identity.username ? identity.label : '',
    username: identity?.username ?? '',
    keyId: identity?.keyId ?? null,
    password: KEEP,
  }
}
