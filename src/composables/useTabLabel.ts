import type { Tab } from '@/ipc/types'
import { formatQuickTarget } from '@/domain/quick-connect'
import { simplifyTitle } from '@/domain/tab-title'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { useHostName } from './useHostName'

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

  function label(tab: Tab): string {
    if (tab.view) return tab.title ?? viewName(tab) ?? targetName(tab)
    if (tab.title) return tab.title
    const short = simplifyTitle(sessions.runtime(tab.id).autoTitle)
    if (!short) return targetName(tab)
    // A remote directory alone would hide which server the tab is on.
    return short.directory && tab.target.kind !== 'local'
      ? `${targetName(tab)} · ${short.text}`
      : short.text
  }

  /** The full terminal title above the target, for the row's tooltip. */
  function tooltip(tab: Tab): string {
    const raw = tab.view || tab.title ? null : sessions.runtime(tab.id).autoTitle
    return raw && raw !== label(tab) ? `${raw}\n${detail(tab)}` : detail(tab)
  }

  function viewName(tab: Tab): string | null {
    const path = tab.view?.path
    return path ? path.replace(/\/+$/, '').split('/').pop() || path : null
  }

  function detail(tab: Tab): string {
    const path = tab.view?.path
    if (path) return `${targetName(tab)} · ${path}`
    const target = tab.target
    if (target.kind === 'host') return vault.describe(target.hostId)
    if (target.kind === 'quick') return formatQuickTarget(target)
    return target.cwd ?? targetName(tab)
  }

  return { label, detail, tooltip, targetName }
}
