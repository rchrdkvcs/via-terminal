import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { openUrl } from '@tauri-apps/plugin-opener'
import { isNative } from '@/ipc/client'
import { terminalTheme, type Presentation } from './theme'

export interface Instance {
  terminal: Terminal
  fit: FitAddon
  search: SearchAddon
  container: HTMLDivElement
  dispose(): void
}

export const MONO_STACK = "'IBM Plex Mono', 'Cascadia Mono', Menlo, Consolas, monospace"

export function fontFamily(presentation: Presentation): string {
  return presentation.fontFamily ? `'${presentation.fontFamily}', ${MONO_STACK}` : MONO_STACK
}

export function applyPresentation(terminal: Terminal, presentation: Presentation) {
  Object.assign(terminal.options, {
    fontFamily: fontFamily(presentation),
    fontSize: presentation.fontSize,
    lineHeight: presentation.lineHeight,
    cursorStyle: presentation.cursorStyle,
    cursorBlink: presentation.cursorBlink,
    scrollback: presentation.scrollback,
    theme: terminalTheme(presentation),
  })
}

function openLink(event: MouseEvent, uri: string) {
  if (!event.ctrlKey && !event.metaKey) return
  if (isNative()) void openUrl(uri).catch(() => undefined)
  else window.open(uri, '_blank', 'noopener,noreferrer')
}

export function createInstance(presentation: Presentation): Instance {
  const container = document.createElement('div')
  container.className = 'h-full w-full'
  const terminal = new Terminal({
    allowProposedApi: true,
    macOptionIsMeta: true,
    minimumContrastRatio: 1,
    drawBoldTextInBrightColors: false,
  })
  applyPresentation(terminal, presentation)
  const fit = new FitAddon()
  const search = new SearchAddon()
  terminal.loadAddon(fit)
  terminal.loadAddon(search)
  terminal.loadAddon(new Unicode11Addon())
  terminal.unicode.activeVersion = '11'
  terminal.loadAddon(new WebLinksAddon(openLink))
  terminal.open(container)

  let webgl: WebglAddon | undefined
  try {
    webgl = new WebglAddon()

    webgl.onContextLoss(() => {
      webgl?.dispose()
      webgl = undefined
    })
    terminal.loadAddon(webgl)
  } catch {
    webgl = undefined
  }

  return {
    terminal,
    fit,
    search,
    container,
    dispose() {
      webgl?.dispose()
      terminal.dispose()
      container.remove()
    },
  }
}
