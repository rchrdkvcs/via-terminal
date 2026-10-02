import { AppWindow, Server, SquareTerminal, Zap } from '@lucide/vue'
import { formatQuickTarget, parseQuickConnect } from '@/domain/quick-connect'
import { rank } from '@/domain/search'
import { tabs } from '@/domain/space'
import { useTabLabel } from '@/composables/useTabLabel'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import type { CommandItem } from './types'

const RECENT = 6

/** Things the bar can open: a typed address, local shells, hosts, open tabs. */
export function useCommandTargets() {
  const settings = useSettings()
  const spaces = useSpaces()
  const vault = useVault()
  const names = useTabLabel()

  function quick(query: string): CommandItem[] {
    const target = parseQuickConnect(query)
    if (!target) return []
    return [
      {
        id: 'quick',
        section: 'Connexion rapide',
        label: `Se connecter à ${formatQuickTarget(target)}`,
        detail: settings.settings.saveQuickConnect
          ? 'Rejoint le coffre une fois connecté'
          : undefined,
        icon: Zap,
        target: { kind: 'quick', ...target },
      },
    ]
  }

  function shells(query: string): CommandItem[] {
    const list = rank(query, settings.shells, (shell) => [shell.name, 'terminal local'])
    return list.map((shell) => ({
      id: `shell:${shell.path}`,
      section: 'Terminaux',
      label: shell.name,
      detail: shell.path,
      icon: SquareTerminal,
      target: { kind: 'local', shell: shell.path, cwd: null },
    }))
  }

  function hosts(query: string): CommandItem[] {
    const all = vault.view.hosts
    const list = query.trim()
      ? rank(query, all, (host) => [
          host.label,
          host.address,
          vault.view.effective[host.id]?.username?.value,
          host.tags.join(' '),
          vault.groupPath(host.groupId).join(' '),
        ])
      : [...vault.recentHosts, ...all.filter((host) => !host.lastConnectedAt)].slice(0, RECENT)
    return list.slice(0, 30).map((host) => ({
      id: `host:${host.id}`,
      section: query.trim() ? 'Hôtes' : 'Hôtes récents',
      label: host.label,
      detail: [vault.describe(host.id), ...vault.groupPath(host.groupId)].join('  '),
      icon: Server,
      target: { kind: 'host', hostId: host.id },
    }))
  }

  function openTabs(query: string): CommandItem[] {
    if (!query.trim()) return []
    const all = spaces.spaces.flatMap((space) => tabs(space).map((tab) => ({ tab, space })))
    return rank(query, all, ({ tab }) => [names.label(tab), names.detail(tab)])
      .slice(0, 6)
      .map(({ tab, space }) => ({
        id: `tab:${tab.id}`,
        section: 'Onglets ouverts',
        label: names.label(tab),
        detail:
          space.id === spaces.active.id
            ? names.detail(tab)
            : `${names.detail(tab)}  dans ${space.name}`,
        icon: AppWindow,
        tabId: tab.id,
      }))
  }

  return { quick, shells, hosts, openTabs }
}
