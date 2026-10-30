import type { Host, HostInput, Identity, IdentityInput } from '@/ipc/types'

const KEEP = { action: 'keep' } as const

export function hostInput(host: Host | undefined): HostInput {
  if (!host) {
    return {
      id: null,
      label: '',
      address: '',
      port: null,
      credential: { kind: 'password', username: null },
      tags: [],
      notes: '',
      password: KEEP,
    }
  }
  return {
    id: host.id,
    label: host.label === host.address ? '' : host.label,
    address: host.address,
    port: host.port,
    credential: { ...host.credential },
    tags: [...host.tags],
    notes: host.notes,
    password: KEEP,
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
