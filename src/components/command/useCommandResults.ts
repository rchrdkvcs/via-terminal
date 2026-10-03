import { computed, type Ref } from 'vue'
import type { Id } from '@/ipc/types'
import { rowOfTab } from '@/domain/space'
import { useSpaces } from '@/stores/spaces'
import { useUi, type CommandMode } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import type { CommandItem } from './types'
import { useCommandActions } from './useCommandActions'
import { useCommandTargets } from './useCommandTargets'

const PLACEHOLDERS: Record<CommandMode['kind'], string> = {
  new: 'Rechercher un hôte, un terminal, ou taper utilisateur@serveur',
  replace: 'Ouvrir à la place dans cet onglet',
  split: 'Choisir ce qui s’affiche à côté',
  actions: 'Rechercher une action',
}

/** What the bar lists for a mode and query, and what choosing a line does. */
export function useCommandResults(query: Ref<string>) {
  const ui = useUi()
  const spaces = useSpaces()
  const workbench = useWorkbench()
  const targets = useCommandTargets()
  const actions = useCommandActions()

  const mode = computed<CommandMode>(() => ui.command ?? { kind: 'new' })
  const placeholder = computed(() => PLACEHOLDERS[mode.value.kind])

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
          // Typing a shell or host name means opening one; switching comes after.
          ...found.quick,
          ...found.shells,
          ...found.hosts,
          ...found.tabs,
          ...(q.trim() ? actions.search(q).slice(0, 4) : []),
        ]
    }
  })

  /** Only a standalone tab of this space can join the view of another. */
  function canJoin(anchorTabId: Id, tabId: Id | undefined): boolean {
    const row = tabId ? rowOfTab(spaces.active, tabId) : undefined
    return row?.kind === 'tab' && row.id !== rowOfTab(spaces.active, anchorTabId)?.id
  }

  function splitWith(anchorTabId: Id, item: CommandItem) {
    if (item.tabId) workbench.splitWith(item.tabId, anchorTabId)
    else if (item.target) workbench.openBeside(item.target, anchorTabId)
  }

  function choose(item: CommandItem) {
    const current = mode.value
    ui.closeCommand()
    if (item.run) return item.run()
    // Opening anything brings the terminals back into view.
    ui.route = 'workbench'
    if (current.kind === 'split') splitWith(current.tabId, item)
    else if (item.tabId) workbench.activate(item.tabId)
    else if (item.target && current.kind === 'replace')
      workbench.open(item.target, { replace: current.tabId })
    else if (item.target) workbench.open(item.target)
  }

  return { mode, placeholder, items, choose }
}
