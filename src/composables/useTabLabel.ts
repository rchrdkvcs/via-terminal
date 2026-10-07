import type { Tab } from '@/ipc/types'
import { formatQuickTarget } from '@/domain/quick-connect'
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

  function usefulTitle(title: string | null): string | null {
    if (!title || /\.exe$/i.test(title) || /^(\/usr)?\/bin\/\w+$/.test(title)) return null
    return title
  }

  function label(tab: Tab): string {
    if (tab.view) return tab.title ?? viewName(tab) ?? targetName(tab)
    return tab.title ?? usefulTitle(sessions.runtime(tab.id).autoTitle) ?? targetName(tab)
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

  return { label, detail, targetName }
}
