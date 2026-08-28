<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { nativeApi, nativeAvailable } from '../api'
import { useAppStore } from '../stores/app'
const props = defineProps<{ sessionId?: string }>()
const host = shallowRef<HTMLElement>()
const terminal = shallowRef<Terminal>()
const fit = new FitAddon()
const store = useAppStore()
let observer: ResizeObserver | undefined
let unlisten: UnlistenFn | undefined
onMounted(async () => {
  const term = new Terminal({
    cursorBlink: true,
    cursorStyle: store.settings.cursorStyle,
    fontFamily: store.settings.fontFamily,
    fontSize: store.settings.fontSize,
    scrollback: 10_000,
    screenReaderMode: true,
    theme: {
      background: '#0d0e12',
      foreground: '#e8e8ed',
      cursor: '#a78bfa',
      selectionBackground: '#7c5ce755',
    },
  })
  terminal.value = term
  term.loadAddon(fit)
  term.loadAddon(
    new WebLinksAddon((event, uri) => {
      if (event.ctrlKey) window.open(uri, '_blank', 'noopener')
    }),
  )
  term.open(host.value!)
  try {
    term.loadAddon(new WebglAddon())
  } catch {
    /* canvas fallback */
  }
  fit.fit()
  term.focus()
  term.onData((data) => {
    if (props.sessionId) void nativeApi.writeSession(props.sessionId, data).catch(() => undefined)
  })
  term.onResize(({ cols, rows }) => {
    if (props.sessionId)
      void nativeApi.resizeSession(props.sessionId, cols, rows).catch(() => undefined)
  })
  observer = new ResizeObserver(() => fit.fit())
  observer.observe(host.value!)
  if (nativeAvailable()) {
    unlisten = await listen<{ sessionId: string; dataBase64: string }>(
      'terminal-output',
      ({ payload }) => {
        if (payload.sessionId === props.sessionId) {
          const binary = atob(payload.dataBase64)
          const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
          term.write(bytes)
        }
      },
    )
  } else {
    term.writeln('\x1b[38;2;167;139;250mAperçu Terminarr\x1b[0m')
    term.writeln('\x1b[90mLancez « pnpm tauri dev » pour ouvrir un terminal natif.\x1b[0m')
  }
})
watch(
  () => store.settings.fontSize,
  (fontSize) => {
    if (terminal.value) {
      terminal.value.options.fontSize = fontSize
      fit.fit()
    }
  },
)
onBeforeUnmount(() => {
  unlisten?.()
  observer?.disconnect()
  terminal.value?.dispose()
})
</script>
<template><div ref="host" class="terminal-host" aria-label="Terminal interactif" /></template>
