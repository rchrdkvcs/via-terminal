import type { Source, Sourced, VaultView } from '@/ipc/types'

type Data = Pick<VaultView, 'identities'>

export function sourceName(data: Data, source: Source): string {
  if (source.kind === 'default') return 'par défaut'
  if (source.kind === 'host') return 'cet élément'
  const identity = data.identities.find((candidate) => candidate.id === source.id)
  return identity ? `identité ${identity.label}` : 'identité supprimée'
}

export function hint<T>(data: Data, sourced: Sourced<T> | null, fallback = ''): string {
  return sourced ? `${String(sourced.value)} (${sourceName(data, sourced.from)})` : fallback
}
