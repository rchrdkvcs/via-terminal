import type { Id, Source, Sourced, VaultView } from '@/ipc/types'

type Data = Pick<VaultView, 'groups' | 'identities'>

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
