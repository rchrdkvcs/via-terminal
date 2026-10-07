import type { Terminal } from '@xterm/xterm'
import type { Id } from '@/ipc/types'

export interface Callbacks {
  onData(tabId: Id, data: string): void
  onResize(tabId: Id, cols: number, rows: number): void
  onTitle(tabId: Id, title: string): void
  onSelection(tabId: Id, text: string): void

  onCwd(tabId: Id, payload: string, osc: 7 | 9): void
}

export function listen(terminal: Terminal, tabId: Id, callbacks: () => Callbacks | null) {
  terminal.onData((data) => callbacks()?.onData(tabId, data))
  terminal.onResize(({ cols, rows }) => callbacks()?.onResize(tabId, cols, rows))
  terminal.onTitleChange((title) => callbacks()?.onTitle(tabId, title.trim()))
  terminal.onSelectionChange(() => callbacks()?.onSelection(tabId, terminal.getSelection()))
  terminal.parser.registerOscHandler(7, (payload) => (callbacks()?.onCwd(tabId, payload, 7), true))

  terminal.parser.registerOscHandler(9, (payload) => {
    if (!payload.startsWith('9;')) return false
    callbacks()?.onCwd(tabId, payload, 9)
    return true
  })
}
