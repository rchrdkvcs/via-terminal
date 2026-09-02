import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { openUrl } from '@tauri-apps/plugin-opener'
import { api, describeError, isNative } from '@/ipc/client'
import { on } from '@/ipc/events'
import type { Id } from '@/ipc/types'
import { concatBytes, decodeBase64 } from '@/lib/base64'
import { MONO_FONT_STACK } from '@/lib/shells'
import { terminalTheme } from './theme'

export interface TerminalPresentation {
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  /** xterm keeps a live DOM mirror of the viewport; costly, so it is opt-in. */
  screenReaderMode: boolean
  scrollback: number
  appearance: 'dark' | 'light'
}

interface Entry {
  sessionId: Id
  terminal: Terminal
  fit: FitAddon
  search: SearchAddon
  /** Owned by the registry and moved between hosts, never recreated. */
  container: HTMLDivElement
  webgl?: WebglAddon
  queue: Uint8Array[]
  cols: number
  rows: number
  resizeFrame: number | null
  disposers: Array<() => void>
  onTitle?: (title: string) => void
}

const MAX_DIMENSION = 1000
const outputDecoder = new TextDecoder()

function terminalContext(bytes: Uint8Array): string | null {
  const text = outputDecoder.decode(bytes)
  const powershell = [...text.matchAll(/(?:^|[\r\n])PS ([^>\r\n]+)>/g)].pop()?.[1]
  if (powershell) return powershell.trim()
  const cmd = [...text.matchAll(/(?:^|[\r\n])([A-Za-z]:\\[^>\r\n]*)>/g)].pop()?.[1]
  return cmd?.trim() || null
}

/**
 * Owns every live xterm instance, keyed by session identifier.
 *
 * TECHNICAL.md requires a session to keep exactly one renderer that is detached
 * and reattached as tabs move. Recreating the terminal on every tab switch —
 * the previous behaviour — discarded the scrollback and left the PTY writing
 * into a disposed instance, so the registry outlives the Vue component tree.
 */
class TerminalRegistry {
  private entries = new Map<Id, Entry>()
  /** Output that arrived between `session_spawn` returning and the pane mounting. */
  private pending = new Map<Id, Uint8Array[]>()
  private dirty = new Set<Id>()
  private frame: number | null = null
  private subscribed = false
  private presentation: TerminalPresentation = {
    fontFamily: MONO_FONT_STACK,
    fontSize: 14,
    cursorStyle: 'bar',
    cursorBlink: true,
    screenReaderMode: false,
    scrollback: 10_000,
    appearance: 'dark',
  }

  /** Reported so the caller can spawn a PTY at the size it will actually get. */
  lastKnownSize = { cols: 80, rows: 24 }

  private subscribe() {
    if (this.subscribed) return
    this.subscribed = true
    on('terminal-output', ({ sessionId, dataBase64 }) => {
      const bytes = decodeBase64(dataBase64)
      const entry = this.entries.get(sessionId)
      if (entry) {
        entry.queue.push(bytes)
        this.dirty.add(sessionId)
        this.scheduleFlush()
        return
      }
      const buffered = this.pending.get(sessionId)
      if (buffered) buffered.push(bytes)
      else this.pending.set(sessionId, [bytes])
    })
  }

  private scheduleFlush() {
    if (this.frame !== null) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      for (const sessionId of this.dirty) {
        const entry = this.entries.get(sessionId)
        if (!entry || entry.queue.length === 0) continue
        const payload = concatBytes(entry.queue)
        entry.queue.length = 0
        entry.terminal.write(payload)
        const context = terminalContext(payload)
        if (context) entry.onTitle?.(context)
      }
      this.dirty.clear()
    })
  }

  setPresentation(presentation: TerminalPresentation) {
    this.presentation = presentation
    for (const entry of this.entries.values()) {
      const { terminal } = entry
      terminal.options.fontFamily = presentation.fontFamily
      terminal.options.fontSize = presentation.fontSize
      terminal.options.cursorStyle = presentation.cursorStyle
      terminal.options.cursorBlink = presentation.cursorBlink
      terminal.options.screenReaderMode = presentation.screenReaderMode
      terminal.options.scrollback = presentation.scrollback
      terminal.options.theme = terminalTheme(presentation.appearance)
      this.scheduleFit(entry)
    }
  }

  /** Snapshot of a session buffer; used by the dev smoke check. */
  readBuffer(sessionId: Id): string {
    const entry = this.entries.get(sessionId)
    if (!entry) return ''
    const buffer = entry.terminal.buffer.active
    const lines: string[] = []
    for (let row = 0; row < buffer.length; row += 1) {
      lines.push(buffer.getLine(row)?.translateToString(true) ?? '')
    }
    return lines.join('\n')
  }

  has(sessionId: Id): boolean {
    return this.entries.has(sessionId)
  }

  search(sessionId: Id): SearchAddon | undefined {
    return this.entries.get(sessionId)?.search
  }

  /**
   * Attach the session's renderer to `host`, creating it on first use.
   * Moving the container is what preserves scrollback across tab and window
   * moves: the element leaves one parent and joins another, never the DOM.
   */
  attach(
    sessionId: Id,
    host: HTMLElement,
    onData?: (data: string) => void,
    onTitle?: (title: string) => void,
  ): void {
    this.subscribe()
    let entry = this.entries.get(sessionId)
    if (!entry) entry = this.create(sessionId, onData, onTitle)
    else entry.onTitle = onTitle
    if (entry.container.parentElement !== host) host.appendChild(entry.container)
    this.scheduleFit(entry)
  }

  /** Take the renderer out of the document without destroying the session. */
  detach(sessionId: Id): void {
    const entry = this.entries.get(sessionId)
    entry?.container.remove()
  }

  focus(sessionId: Id): void {
    this.entries.get(sessionId)?.terminal.focus()
  }

  /**
   * An SSH retry produces a new PTY for the same visible pane. Rebinding keeps
   * the scrollback the user was reading instead of clearing the screen.
   */
  rebind(previousId: Id, nextId: Id): void {
    const entry = this.entries.get(previousId)
    if (!entry || previousId === nextId) return
    this.entries.delete(previousId)
    entry.sessionId = nextId
    this.entries.set(nextId, entry)
    const buffered = this.pending.get(nextId)
    if (buffered) {
      this.pending.delete(nextId)
      entry.queue.push(...buffered)
      this.dirty.add(nextId)
      this.scheduleFlush()
    }
    void api.resizeSession(nextId, entry.cols, entry.rows).catch(() => undefined)
  }

  /** Destroy the renderer. The PTY is closed separately by the store. */
  release(sessionId: Id): void {
    const entry = this.entries.get(sessionId)
    if (!entry) return
    this.entries.delete(sessionId)
    this.dirty.delete(sessionId)
    this.pending.delete(sessionId)
    if (entry.resizeFrame !== null) cancelAnimationFrame(entry.resizeFrame)
    for (const dispose of entry.disposers) dispose()
    entry.webgl?.dispose()
    entry.terminal.dispose()
    entry.container.remove()
  }

  releaseAll(): void {
    for (const sessionId of this.entries.keys()) this.release(sessionId)
  }

  /** Re-measure after a container resize; safe to call on every frame. */
  requestFit(sessionId: Id): void {
    const entry = this.entries.get(sessionId)
    if (entry) this.scheduleFit(entry)
  }

  write(sessionId: Id, text: string): void {
    this.entries.get(sessionId)?.terminal.write(text)
  }

  private create(
    sessionId: Id,
    onData?: (data: string) => void,
    onTitle?: (title: string) => void,
  ): Entry {
    const container = document.createElement('div')
    container.className = 'h-full w-full'

    const terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: false,
      convertEol: false,
      cursorBlink: this.presentation.cursorBlink,
      cursorStyle: this.presentation.cursorStyle,
      fontFamily: this.presentation.fontFamily,
      fontSize: this.presentation.fontSize,
      lineHeight: 1.2,
      macOptionIsMeta: true,
      minimumContrastRatio: 1,
      scrollback: this.presentation.scrollback,
      screenReaderMode: this.presentation.screenReaderMode,
      theme: terminalTheme(this.presentation.appearance),
    })

    const fit = new FitAddon()
    const search = new SearchAddon()
    terminal.loadAddon(fit)
    terminal.loadAddon(search)

    const unicode = new Unicode11Addon()
    terminal.loadAddon(unicode)
    terminal.unicode.activeVersion = '11'

    // TECHNICAL.md: links open in the system browser and only with Ctrl+click.
    terminal.loadAddon(
      new WebLinksAddon(
        (event, uri) => {
          if (!event.ctrlKey && !event.metaKey) return
          if (isNative()) void openUrl(uri).catch(() => undefined)
          else window.open(uri, '_blank', 'noopener,noreferrer')
        },
        { urlRegex: /https?:\/\/[\w\-@:%._+~#=/?&]{2,}/ },
      ),
    )

    terminal.open(container)
    this.loadWebgl(terminal, container)

    const entry: Entry = {
      sessionId,
      terminal,
      fit,
      search,
      container,
      queue: [],
      cols: terminal.cols,
      rows: terminal.rows,
      resizeFrame: null,
      disposers: [],
      onTitle,
    }

    const data = terminal.onData((value) => {
      if (onData) onData(value)
      else void api.writeSession(entry.sessionId, value).catch(() => undefined)
    })
    // Bracketed paste and multiline input are forwarded verbatim by onData.
    const resize = terminal.onResize(({ cols, rows }) => {
      entry.cols = cols
      entry.rows = rows
      this.lastKnownSize = { cols, rows }
      void api.resizeSession(entry.sessionId, cols, rows).catch(() => undefined)
    })
    const title = terminal.onTitleChange((value) => entry.onTitle?.(value.trim()))
    entry.disposers.push(
      () => data.dispose(),
      () => resize.dispose(),
      () => title.dispose(),
    )

    this.entries.set(sessionId, entry)

    const buffered = this.pending.get(sessionId)
    if (buffered) {
      this.pending.delete(sessionId)
      entry.queue.push(...buffered)
      this.dirty.add(sessionId)
      this.scheduleFlush()
    }

    // Cell metrics are wrong until the monospace face is resolved.
    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts.ready.then(() => this.scheduleFit(entry))
    }
    return entry
  }

  private loadWebgl(terminal: Terminal, container: HTMLElement) {
    try {
      const webgl = new WebglAddon()
      // A lost GPU context leaves a blank canvas forever unless we fall back.
      webgl.onContextLoss(() => {
        webgl.dispose()
        const entry = [...this.entries.values()].find((item) => item.container === container)
        if (entry) entry.webgl = undefined
      })
      terminal.loadAddon(webgl)
      const entry = [...this.entries.values()].find((item) => item.container === container)
      if (entry) entry.webgl = webgl
    } catch {
      // WebGL2 unavailable (software rendering, RDP): the DOM renderer stands in.
    }
  }

  /**
   * Fitting synchronously inside a ResizeObserver callback re-enters layout and
   * can loop; deferring to the next frame collapses a drag into one measure.
   */
  private scheduleFit(entry: Entry) {
    if (entry.resizeFrame !== null) return
    entry.resizeFrame = requestAnimationFrame(() => {
      entry.resizeFrame = null
      if (!entry.container.isConnected) return
      const proposed = entry.fit.proposeDimensions()
      if (!proposed) return
      const cols = Math.min(Math.max(proposed.cols, 1), MAX_DIMENSION)
      const rows = Math.min(Math.max(proposed.rows, 1), MAX_DIMENSION)
      if (!Number.isFinite(cols) || !Number.isFinite(rows)) return
      this.lastKnownSize = { cols, rows }
      // `resize` is a no-op when the size is unchanged, so onResize stays quiet
      // and no redundant IPC call is made while dragging a splitter.
      entry.terminal.resize(cols, rows)
    })
  }
}

export const terminals = new TerminalRegistry()

// Dev-only handle so the registry can be inspected from the WebView2 debugger.
// The WebGL renderer paints to a canvas, so a terminal's contents are otherwise
// unreachable from the DOM.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __viaTerminal?: unknown }).__viaTerminal = { terminals }
}

/** Shared by the store when reporting a failed terminal operation. */
export { describeError }
