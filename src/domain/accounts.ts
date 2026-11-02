import type { Id, Target, VaultView } from '@/ipc/types'

/** One account the remote explorer can switch to on the same server. */
export interface Account {
  id: string
  username: string | null
  /** The vault host it comes from, when it is one. */
  hostId: Id | null
  label: string
  target: Target
  current: boolean
}

interface Endpoint {
  address: string
  port: number
  username: string | null
}

const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Address, port and account a remote target connects to. */
export function endpointOf(target: Target, vault: VaultView): Endpoint | null {
  if (target.kind === 'local') return null
  if (target.kind === 'quick')
    return { address: target.address, port: target.port ?? 22, username: target.username }
  const host = vault.hosts.find((candidate) => candidate.id === target.hostId)
  if (!host) return null
  const effective = vault.effective[host.id]
  return {
    address: host.address,
    port: effective?.port.value ?? host.port ?? 22,
    username: effective?.username?.value ?? null,
  }
}

/**
 * The vault hosts reaching the same address and port as `target`, one per username.
 * A target that matches none of them is listed first, as the current account.
 */
export function accountsFor(target: Target, vault: VaultView): Account[] {
  const here = endpointOf(target, vault)
  if (!here) return []
  const accounts: Account[] = []
  for (const host of vault.hosts) {
    const there = endpointOf({ kind: 'host', hostId: host.id }, vault)
    if (!there || !sameAddress(there.address, here.address) || there.port !== here.port) continue
    const current = target.kind === 'host' && target.hostId === host.id
    if (!current && accounts.some((account) => account.username === there.username)) continue
    accounts.push({
      id: `host:${host.id}`,
      username: there.username,
      hostId: host.id,
      label: host.label || host.address,
      target: { kind: 'host', hostId: host.id },
      current,
    })
  }
  if (!accounts.some((account) => account.current))
    accounts.unshift({
      id: 'current',
      username: here.username,
      hostId: null,
      label: here.address,
      target,
      current: true,
    })
  return accounts
}

/** A typed account on the same server, connected like a quick connection. */
export function otherAccount(target: Target, vault: VaultView, username: string): Target | null {
  const here = endpointOf(target, vault)
  const name = username.trim()
  if (!here || !name || /[\s@]/.test(name)) return null
  return {
    kind: 'quick',
    address: here.address,
    port: here.port === 22 ? null : here.port,
    username: name,
  }
}
