import type { Tab } from '@/ipc/types'
import { formatQuickTarget } from '@/domain/quick-connect'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { useHostName } from './useHostName'

/**
 * How a tab is named everywhere: its manual name, else the terminal title,
 * else what it connects to. The detail line always says where it connects.
 */
export function useTabLabel() {
  const sessions = useSessions()
  const settings = useSettings()
  const spaces = useSpaces()
  const vault = useVault()
  const hostName = useHostName()

  function targetName(tab: Tab): string {
    const target = tab.target
    if (target.kind === 'host') return hostName(target.hostId)
    if (target.kind === 'quick') return formatQuickTarget(target)
    const space = spaces.spaceOf(tab.id)
    return settings.shellName(target.shell, space?.defaultShell ?? null)
  }

  /** Shells often title themselves with their own executable path: no news there. */
  function usefulTitle(title: string | null): string | null {
    if (!title || /\.exe$/i.test(title) || /^(\/usr)?\/bin\/\w+$/.test(title)) return null
    return title
  }

  function label(tab: Tab): string {
    return tab.title ?? usefulTitle(sessions.runtime(tab.id).autoTitle) ?? targetName(tab)
  }

  function detail(tab: Tab): string {
    const target = tab.target
    if (target.kind === 'host') return vault.describe(target.hostId)
    if (target.kind === 'quick') return formatQuickTarget(target)
    return target.cwd ?? targetName(tab)
  }

  return { label, detail, targetName }
}
