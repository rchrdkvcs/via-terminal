/** Host search: every word must appear in the label, address, user, tags or group path. */
import type { Host } from '@/ipc/types'

/** Case and accent insensitive, so "donnees" finds "Données". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export interface Searchable {
  host: Host
  /** The effective username, inherited or not. */
  username: string | null
  groupPath: string[]
}

export function matches({ host, username, groupPath }: Searchable, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = normalize(
    [host.label, host.address, username ?? '', ...host.tags, ...groupPath].join('\n'),
  )
  return words.every((word) => haystack.includes(word))
}
