import { tabs } from '@/domain/space'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'

export async function adoptTabNames() {
  const spaces = useSpaces()
  const vault = useVault()
  for (const space of spaces.spaces) {
    for (const tab of tabs(space)) {
      if (tab.target.kind !== 'host' || !tab.title || !vault.isUnnamed(tab.target.hostId)) continue
      await vault.rename(tab.target.hostId, tab.title).catch(() => undefined)
      spaces.dispatch({ type: 'updateTab', tabId: tab.id, patch: { title: null } }, space.id)
    }
  }
}
