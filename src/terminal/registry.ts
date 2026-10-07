import type { Id, Size } from '@/ipc/types'
import { concatBytes } from '@/lib/base64'
import { applyPresentation, createInstance, type Instance } from './create'
import { fitNow, nextFrame } from './size'
import { defaultPresentation, type Presentation } from './theme'
import { listen, type Callbacks } from './listen'

interface Entry extends Instance {
  queue: Uint8Array[]
  frame: number | null
}

class Registry {
  private entries = new Map<Id, Entry>()
  private dirty = new Set<Id>()
  private frame: number | null = null
  private lastSize: Size = { cols: 100, rows: 30 }
  private callbacks: Callbacks | null = null
  private presentation: Presentation = defaultPresentation

  configure(callbacks: Callbacks) {
    this.callbacks = callbacks
  }

  setPresentation(presentation: Presentation) {
    this.presentation = presentation
    for (const entry of this.entries.values()) {
      applyPresentation(entry.terminal, presentation)
      this.fit(entry)
    }
  }

  sizeFor(tabId: Id): Size {
    const terminal = this.entries.get(tabId)?.terminal
    return terminal ? { cols: terminal.cols, rows: terminal.rows } : this.lastSize
  }

  async measure(tabId: Id): Promise<Size> {
    for (let frame = 0; frame < 12; frame += 1) {
      const entry = this.entries.get(tabId)
      if (entry && fitNow(entry)) return this.sizeFor(tabId)
      await nextFrame()
    }
    return this.sizeFor(tabId)
  }

  feed(tabId: Id, bytes: Uint8Array) {
    this.ensure(tabId).queue.push(bytes)
    this.dirty.add(tabId)
    this.frame ??= requestAnimationFrame(() => this.flush())
  }

  attach(tabId: Id, host: HTMLElement) {
    const entry = this.ensure(tabId)
    if (entry.container.parentElement !== host) host.appendChild(entry.container)
    this.fit(entry)
  }

  detach(tabId: Id) {
    this.entries.get(tabId)?.container.remove()
  }

  refit(tabId: Id) {
    const entry = this.entries.get(tabId)
    if (entry) this.fit(entry)
  }

  focus(tabId: Id) {
    this.entries.get(tabId)?.terminal.focus()
  }

  search(tabId: Id, query: string, direction: 1 | -1 = 1): boolean {
    const search = this.entries.get(tabId)?.search
    if (!search || !query) return false
    const options = { incremental: direction === 1, caseSensitive: false }
    return direction === 1 ? search.findNext(query, options) : search.findPrevious(query, options)
  }

  clearSearch(tabId: Id) {
    this.entries.get(tabId)?.search.clearDecorations()
  }

  selection(tabId: Id): string {
    return this.entries.get(tabId)?.terminal.getSelection() ?? ''
  }

  paste(tabId: Id, text: string) {
    this.entries.get(tabId)?.terminal.paste(text)
  }

  release(tabId: Id) {
    const entry = this.entries.get(tabId)
    if (!entry) return
    if (entry.frame !== null) cancelAnimationFrame(entry.frame)
    this.entries.delete(tabId)
    this.dirty.delete(tabId)
    entry.dispose()
  }

  private flush() {
    this.frame = null
    for (const tabId of this.dirty) {
      const entry = this.entries.get(tabId)
      if (!entry?.queue.length) continue
      entry.terminal.write(concatBytes(entry.queue))
      entry.queue.length = 0
    }
    this.dirty.clear()
  }

  private ensure(tabId: Id): Entry {
    const existing = this.entries.get(tabId)
    if (existing) return existing
    const entry: Entry = { ...createInstance(this.presentation), queue: [], frame: null }
    const { terminal } = entry
    terminal.onResize(({ cols, rows }) => {
      this.lastSize = { cols, rows }
    })
    listen(terminal, tabId, () => this.callbacks)

    void document.fonts?.ready.then(() => {
      if (this.entries.get(tabId) === entry) this.fit(entry)
    })
    this.entries.set(tabId, entry)
    return entry
  }

  private fit(entry: Entry) {
    if (entry.frame !== null) return
    entry.frame = requestAnimationFrame(() => {
      entry.frame = null
      const size = fitNow(entry)
      if (size) this.lastSize = size
    })
  }
}

export const terminals = new Registry()

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __viaTerminals?: Registry }).__viaTerminals = terminals
}
