import { computed, type Ref } from 'vue'
import type { Id } from '@/ipc/types'
import { findTab, rowOfTab } from '@/domain/space'
import { formatQuickTarget } from '@/domain/quick-connect'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { useUi, type CommandMode } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import type { CommandItem } from './types'
import { useClosing } from '@/composables/useClosing'
import { useCommandActions } from './useCommandActions'
import { useCommandTargets } from './useCommandTargets'

const PLACEHOLDERS: Record<CommandMode['kind'], string> = {
  new: 'Rechercher un hôte, un terminal, ou taper utilisateur@serveur',
  replace: 'Ouvrir à la place dans cet onglet',
  split: 'Choisir ce qui s’affiche à côté',
  actions: 'Rechercher une action',
}

export function useCommandResults(query: Ref<string>) {
  const ui = useUi()
  const spaces = useSpaces()
  const workbench = useWorkbench()
  const sessions = useSessions()
  const targets = useCommandTargets()
  const actions = useCommandActions()

  const mode = computed<CommandMode>(() => ui.command ?? { kind: 'new' })
  const placeholder = computed(() => PLACEHOLDERS[mode.value.kind])

  function initialQuery(): string {
    const current = mode.value
    const space = current.kind === 'replace' ? spaces.spaceOf(current.tabId) : undefined
    const tab =
      current.kind === 'replace'
        ? space && findTab(space, current.tabId)
        : current.kind === 'new'
          ? workbench.activeTab
          : undefined
    if (!tab || tab.target.kind !== 'quick' || sessions.runtime(tab.id).state !== 'failed')
      return ''
    // Keep an explicit default port too: it can make a short hostname parseable.
    return formatQuickTarget(tab.target) + (tab.target.port === 22 ? ':22' : '')
  }

  const items = computed<CommandItem[]>(() => {
    const q = query.value
    const found = {
      quick: targets.quick(q),
      shells: targets.shells(q),
      hosts: targets.hosts(q),
      tabs: targets.openTabs(q),
    }
    const current = mode.value
    switch (current.kind) {
      case 'actions':
        return [
          ...actions.search(q),
          ...found.quick,
          ...found.tabs,
          ...found.hosts,
          ...found.shells,
        ]
      case 'replace':
        return [...found.quick, ...found.shells, ...found.hosts]
      case 'split':
        return [
          ...found.quick,
          ...found.tabs.filter((item) => canJoin(current.tabId, item.tabId)),
          ...found.shells,
          ...found.hosts,
        ]
      case 'new':
        return [
          ...found.quick,
          ...found.shells,
          ...found.hosts,
          ...found.tabs,
          ...(q.trim() ? actions.search(q).slice(0, 4) : []),
        ]
    }
  })

  function canJoin(anchorTabId: Id, tabId: Id | undefined): boolean {
    const row = tabId ? rowOfTab(spaces.active, tabId) : undefined
    return row?.kind === 'tab' && row.id !== rowOfTab(spaces.active, anchorTabId)?.id
  }

  function splitWith(anchorTabId: Id, item: CommandItem) {
    if (item.tabId) workbench.splitWith(item.tabId, anchorTabId)
    else if (item.target) workbench.openBeside(item.target, anchorTabId)
  }

  const closing = useClosing()
  async function choose(item: CommandItem) {
    const current = mode.value
    ui.closeCommand()
    if (item.run) return item.run()

    ui.route = 'workbench'
    if (current.kind === 'split') splitWith(current.tabId, item)
    else if (item.tabId) workbench.activate(item.tabId)
    else if (item.target && current.kind === 'replace')
      await closing.replaceTab(current.tabId, item.target)
    else if (item.target) workbench.open(item.target)
  }

  return { mode, placeholder, items, choose, initialQuery }
}
