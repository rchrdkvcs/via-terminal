import { onBeforeUnmount, onMounted } from 'vue'
import { match, type ActionId } from '@/lib/shortcuts'
import { rowOfTab } from '@/domain/space'
import { terminals } from '@/terminal/registry'
import { useSettings } from '@/stores/settings'
import { useTabClosing } from './useTabClosing'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'

export function useShortcuts() {
  const settings = useSettings()
  const spaces = useSpaces()
  const ui = useUi()
  const workbench = useWorkbench()
  const closing = useTabClosing()

  function run(id: ActionId, digit?: number) {
    const tab = workbench.activeTab
    const row = tab && rowOfTab(spaces.active, tab.id)
    const actions: Record<ActionId, () => void> = {
      newTab: () => ui.openCommand({ kind: 'new' }),
      retarget: () => ui.openCommand(tab ? { kind: 'replace', tabId: tab.id } : { kind: 'new' }),
      actions: () => ui.openCommand({ kind: 'actions' }),
      closeTab: () => tab && closing.close(tab.id),
      pin: () => row && workbench.togglePin(row.id),
      split: () => tab && ui.openCommand({ kind: 'split', tabId: tab.id }),
      nextTab: () => workbench.cycle(1),
      previousTab: () => workbench.cycle(-1),
      space: () => {
        const space = spaces.spaces[(digit ?? 1) - 1]
        if (space) spaces.activate(space.id)
      },
      sidebar: () => spaces.setSidebar({ visible: !spaces.sidebar.visible }),
      search: () => tab && (ui.searching = true),
      copy: () => {
        const selection = tab && terminals.selection(tab.id)
        if (selection) void navigator.clipboard.writeText(selection)
      },
      paste: () => {
        if (tab) void navigator.clipboard.readText().then((text) => terminals.paste(tab.id, text))
      },
      settings: () => (ui.route = ui.route === 'settings' ? 'workbench' : 'settings'),
      vault: () => (ui.route = ui.route === 'vault' ? 'workbench' : 'vault'),
    }
    actions[id]()
  }

  function onKeydown(event: KeyboardEvent) {
    const found = match(event, settings.platform)
    if (!found) return

    const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]')
    if (dialog && found.id !== 'newTab') return
    event.preventDefault()
    event.stopPropagation()
    run(found.id, found.digit)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown, { capture: true }))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, { capture: true }))
}
