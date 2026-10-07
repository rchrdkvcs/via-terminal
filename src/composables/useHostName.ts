import { computed } from 'vue'
import type { Id } from '@/ipc/types'
import { tabs } from '@/domain/space'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'

export function useHostName() {
  const vault = useVault()
  const spaces = useSpaces()

  const tabNames = computed(() => {
    const names = new Map<Id, string>()
    for (const tab of spaces.spaces.flatMap(tabs)) {
      if (tab.target.kind === 'host' && tab.title && !names.has(tab.target.hostId)) {
        names.set(tab.target.hostId, tab.title)
      }
    }
    return names
  })

  return function hostName(hostId: Id): string {
    const host = vault.host(hostId)
    if (!host) return 'Hôte supprimé'
    if (host.label && host.label !== host.address) return host.label
    return tabNames.value.get(hostId) ?? host.address
  }
}
