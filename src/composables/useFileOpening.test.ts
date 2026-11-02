import { describe, expect, it } from 'vitest'
import type { DocumentOpening, ExplorerOpening, Row } from '@/ipc/types'
import { findTab, rows } from '@/domain/space'
import { useFiles } from '@/stores/files'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import { row, setup } from '@/stores/workbench.fixture'
import { useFileOpening } from './useFileOpening'

const remote = (id: string): Extract<Row, { kind: 'tab' }> => ({
  ...row(id),
  target: { kind: 'host', hostId: 'host' },
})

function open(
  explorer: ExplorerOpening,
  document: DocumentOpening = 'tab',
  temporary = [remote('ssh')],
) {
  const context = setup([], temporary)
  const settings = useSettings()
  settings.settings.explorerOpening = explorer
  settings.settings.documentOpening = document
  context.workbench.activate('ssh', { wake: false })
  const terminal = findTab(context.spaces.active, 'ssh')!
  return { ...context, terminal, opening: useFileOpening(), files: useFiles(), ui: useUi() }
}

describe('opening the remote explorer', () => {
  it('toggles the docked explorer in panel mode', () => {
    const { terminal, opening, files } = open('panel')
    opening.toggleExplorer(terminal)
    expect(files.state('ssh').visible).toBe(true)
    opening.toggleExplorer(terminal)
    expect(files.state('ssh').visible).toBe(false)
  })

  it('opens an explorer tab and moves to it in tab mode', () => {
    const { terminal, opening, spaces, workbench } = open('tab')
    opening.toggleExplorer(terminal)
    const explorer = workbench.activeTab!
    expect(explorer.view?.kind).toBe('files')
    workbench.activate('ssh', { wake: false })
    opening.toggleExplorer(terminal)
    expect(workbench.activeTab?.id).toBe(explorer.id)
    expect(rows(spaces.active)).toHaveLength(2)
  })

  it('shows the explorer in a dialog in dialog mode', () => {
    const { terminal, opening, files, ui } = open('dialog')
    opening.toggleExplorer(terminal)
    expect(ui.filesDialog).toEqual({ kind: 'files', tabId: 'ssh' })
    expect(files.state('ssh').visible).toBe(false)
  })

  it('never opens an explorer for a local shell', () => {
    const { opening, spaces, ui } = open('dialog', 'tab', [remote('ssh'), row('local')])
    opening.openExplorer(findTab(spaces.active, 'local')!)
    expect(ui.filesDialog).toBeNull()
  })
})

describe('opening a remote document', () => {
  it('replaces the docked or dialog list in panel mode', () => {
    const { terminal, opening, files, spaces } = open('panel', 'panel')
    opening.openDocument(terminal, '/etc/hosts', 'docked')
    expect(files.state('ssh').opened).toBe('/etc/hosts')
    expect(rows(spaces.active)).toHaveLength(1)
    files.closeDocument('ssh')
    expect(files.state('ssh').opened).toBeNull()
  })

  it('splits beside an explorer tab in panel mode', () => {
    const { opening, spaces, workbench } = open('tab', 'panel', [
      remote('ssh'),
      { ...remote('explorer'), view: { kind: 'files', path: '/' } },
    ])
    opening.openDocument(findTab(spaces.active, 'explorer')!, '/etc/hosts', 'tab')
    const split = rows(spaces.active).find((row) => row.kind === 'split')
    expect(split?.kind === 'split' && split.tabs.map((tab) => tab.view)).toEqual([
      { kind: 'files', path: '/' },
      { kind: 'document', path: '/etc/hosts' },
    ])
    expect(workbench.activeTab?.view).toEqual({ kind: 'document', path: '/etc/hosts' })
  })

  it('opens a dialog from a docked explorer, in place of the list from a dialog one', () => {
    const { terminal, opening, files, ui } = open('dialog', 'dialog')
    opening.openDocument(terminal, '/etc/hosts', 'docked')
    expect(ui.filesDialog).toEqual({ kind: 'document', tabId: 'ssh', path: '/etc/hosts' })
    ui.filesDialog = { kind: 'files', tabId: 'ssh' }
    opening.openDocument(terminal, '/etc/motd', 'dialog')
    expect(files.state('ssh').opened).toBe('/etc/motd')
    expect(ui.filesDialog).toEqual({ kind: 'files', tabId: 'ssh' })
  })

  it('leaves the dialog for a document tab in tab mode', () => {
    const { terminal, opening, ui, workbench } = open('dialog', 'tab')
    ui.filesDialog = { kind: 'files', tabId: 'ssh' }
    opening.openDocument(terminal, '/etc/hosts', 'dialog')
    expect(ui.filesDialog).toBeNull()
    expect(workbench.activeTab?.view).toEqual({ kind: 'document', path: '/etc/hosts' })
  })
})
