import {
  Columns2,
  FolderPlus,
  KeyRound,
  LayoutGrid,
  Pencil,
  Pin,
  Plus,
  Settings,
  X,
} from '@lucide/vue'
import { rank } from '@/domain/search'
import { isPinned, rowOfTab } from '@/domain/space'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useTabClosing } from '@/composables/useTabClosing'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import type { CommandItem } from './types'

export function useCommandActions() {
  const spaces = useSpaces()
  const ui = useUi()
  const workbench = useWorkbench()
  const sidebar = useSidebarActions()
  const kbd = useShortcutLabel()
  const closing = useTabClosing()

  function all(): CommandItem[] {
    const section = 'Actions'
    const tab = workbench.activeTab
    const row = tab && rowOfTab(spaces.active, tab.id)
    const items: CommandItem[] = [
      {
        id: 'host:new',
        section,
        label: 'Nouvel hôte',
        icon: Plus,
        run: () => ui.showVault('hosts', null),
      },
      {
        id: 'vault',
        section,
        label: 'Ouvrir le coffre',
        icon: KeyRound,
        shortcut: kbd('vault'),
        run: () => (ui.route = 'vault'),
      },
      {
        id: 'space:new',
        section,
        label: 'Nouvel espace',
        icon: LayoutGrid,
        run: () => (ui.spaceForm = { id: null }),
      },
      {
        id: 'folder:new',
        section,
        label: 'Nouveau dossier',
        icon: FolderPlus,
        run: () => (ui.renaming = sidebar.newFolder()),
      },
      {
        id: 'settings',
        section,
        label: 'Réglages',
        icon: Settings,
        shortcut: kbd('settings'),
        run: () => (ui.route = 'settings'),
      },
    ]
    if (tab && row) {
      const pinned = isPinned(spaces.active, row.id)
      items.unshift(
        {
          id: 'tab:pin',
          section,
          label: pinned ? 'Désépingler l’onglet' : 'Épingler l’onglet',
          icon: Pin,
          shortcut: kbd('pin'),
          run: () => workbench.togglePin(row.id),
        },
        {
          id: 'tab:split',
          section,
          label: 'Partager la vue avec…',
          icon: Columns2,
          shortcut: kbd('split'),
          run: () => ui.openCommand({ kind: 'split', tabId: tab.id }),
        },
        {
          id: 'tab:rename',
          section,
          label: 'Renommer l’onglet',
          icon: Pencil,
          shortcut: 'F2',
          run: () => (ui.renaming = tab.id),
        },
        {
          id: 'tab:close',
          section,
          label: 'Fermer l’onglet',
          icon: X,
          shortcut: kbd('closeTab'),
          run: () => closing.close(tab.id),
        },
      )
    }
    for (const space of spaces.spaces) {
      if (space.id === spaces.active.id) continue
      items.push({
        id: `space:${space.id}`,
        section: 'Espaces',
        label: `Aller à ${space.name}`,
        icon: LayoutGrid,
        run: () => spaces.activate(space.id),
      })
    }
    return items
  }

  function search(query: string): CommandItem[] {
    return query.trim() ? rank(query, all(), (item) => [item.label, item.section]) : all()
  }

  return { search }
}
