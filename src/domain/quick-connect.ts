/**
 * Reading an address typed in the command bar: `host`, `user@host`,
 * `user@host:2222`, `[::1]:22`, or a pasted `ssh -p 2222 user@host`.
 */
import type { QuickTarget } from '@/ipc/types'

const HOST =
  /^(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)$/i

function port(value: string | undefined): number | null | undefined {
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : undefined
}

export function parseQuickConnect(input: string): QuickTarget | null {
  const words = input.trim().split(/\s+/).filter(Boolean)
  if (words[0] === 'ssh') words.shift()
  let flagPort: string | undefined
  let flagUser: string | undefined
  const rest: string[] = []
  for (let index = 0; index < words.length; index += 1) {
    if (words[index] === '-p') flagPort = words[++index]
    else if (words[index] === '-l') flagUser = words[++index]
    else rest.push(words[index])
  }
  if (rest.length !== 1) return null
  const match = /^(?:([^@\s]+)@)?(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(rest[0])
  if (!match) return null
  const [, user, host, inlinePort] = match
  const resolvedPort = port(flagPort ?? inlinePort)
  if (resolvedPort === undefined || !HOST.test(host)) return null
  // A bare word is a search term, not an address, unless it looks like one.
  const looksLikeAddress = Boolean(user || inlinePort || flagPort || /[.:]/.test(host))
  if (!looksLikeAddress) return null
  return {
    address: host.replace(/^\[|\]$/g, ''),
    port: resolvedPort,
    username: flagUser ?? user ?? null,
  }
}

export function formatQuickTarget(target: QuickTarget): string {
  const user = target.username ? `${target.username}@` : ''
  const host = target.address.includes(':') ? `[${target.address}]` : target.address
  return `${user}${host}${target.port && target.port !== 22 ? `:${target.port}` : ''}`
}
