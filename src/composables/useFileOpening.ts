import { tabs } from '@/domain/space'
import type { Tab } from '@/ipc/types'
import { useFiles } from '@/stores/files'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'

/** Where an explorer shows its files: beside its terminal, in its own tab, or in a dialog. */
export type ExplorerPlace = 'docked' | 'tab' | 'dialog'

/** Opens remote explorers and documents where the settings say, when the user asks. */
export function useFileOpening() {
  const files = useFiles()
  const settings = useSettings()
  const spaces = useSpaces()
  const ui = useUi()
  const workbench = useWorkbench()

  /** The explorer tab of the terminal's target already in its space, if any. */
  function explorerTab(terminal: Tab): Tab | undefined {
    const space = spaces.spaceOf(terminal.id)
    const same = JSON.stringify(terminal.target)
    return (
      space &&
      tabs(space).find((tab) => tab.view?.kind === 'files' && JSON.stringify(tab.target) === same)
    )
  }

  /** Whether the terminal's explorer is open in the place the settings choose. */
  function explorerShown(terminal: Tab): boolean {
    const mode = settings.settings.explorerOpening
    if (mode === 'panel') return files.state(terminal.id).visible
    if (mode === 'dialog')
      return ui.filesDialog?.kind === 'files' && ui.filesDialog.tabId === terminal.id
    return false
  }

  /** Shows the remote explorer of an SSH terminal: docked, focused in a tab, or in a dialog. */
  function openExplorer(terminal: Tab) {
    if (terminal.target.kind === 'local' || terminal.view) return
    ui.route = 'workbench'
    const mode = settings.settings.explorerOpening
    if (mode === 'panel') files.setVisible(terminal.id, true)
    else if (mode === 'dialog') ui.filesDialog = { kind: 'files', tabId: terminal.id }
    else {
      const existing = explorerTab(terminal)
      if (existing) workbench.activate(existing.id)
      else workbench.openView(terminal, { kind: 'files', path: terminal.remoteCwd ?? null })
    }
  }

  /** The title bar button: a docked explorer is toggled, the other places are opened. */
  function toggleExplorer(terminal: Tab) {
    if (settings.settings.explorerOpening === 'panel' && explorerShown(terminal)) {
      files.hide(terminal.id)
      ui.route = 'workbench'
    } else openExplorer(terminal)
  }

  /**
   * Opens a document from the explorer of `tab`, shown in `place`. In panel mode it replaces
   * the docked or dialog explorer's list, or splits beside an explorer tab.
   */
  function openDocument(tab: Tab, path: string, place: ExplorerPlace) {
    const mode = settings.settings.documentOpening
    const inline =
      place !== 'tab' && (mode === 'panel' || (mode === 'dialog' && place === 'dialog'))
    if (inline) files.showDocument(tab.id, path)
    else if (mode === 'dialog') ui.filesDialog = { kind: 'document', tabId: tab.id, path }
    else {
      if (place === 'dialog') ui.filesDialog = null
      const view = { kind: 'document', path } as const
      workbench.openView(tab, view, mode === 'panel' ? { beside: 'right' } : {})
    }
  }

  return { explorerShown, openExplorer, toggleExplorer, openDocument }
}
