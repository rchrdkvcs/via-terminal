import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import WindowControls from '@/components/shell/WindowControls.vue'
import type { RemoteDocument } from '@/stores/file-documents'
import { useFiles } from '@/stores/files'
import { useFileExit } from './useFileExit'

/**
 * Tauri 2 close protocol, shared by the macOS traffic light and the Windows
 * title-bar X. A JS listener makes the runtime veto the native close. The
 * listener then calls `destroy()` unless the handler vetoed too. Destroying
 * the last window raises `ExitRequested` with no code, which the process
 * handler vetoes and turns into `app-exit-requested`. `destroy` is denied
 * unless the capability grants it. The only exit that handler lets through
 * is `app_exit` (code Some).
 */
const bridge = vi.hoisted(() => ({
  exited: false,
  destroyed: false,
  deliver: undefined as (() => Promise<void>) | undefined,
  listeners: [] as { name: string; handler: (event: { payload: null }) => void }[],
  allowDestroy: (): boolean => false,
}))

vi.mock('@/lib/notify', () => ({
  notify: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === 'app_exit') bridge.exited = true
  }),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload: null }) => void) => {
    bridge.listeners = bridge.listeners.filter((listener) => listener.name !== name)
    bridge.listeners.push({ name, handler })
    return () => undefined
  }),
}))

vi.mock('@tauri-apps/api/window', () => {
  class CloseRequestedEvent {
    private prevented = false
    preventDefault() {
      this.prevented = true
    }
    isPreventDefault() {
      return this.prevented
    }
  }
  /** What `@tauri-apps/api` does after the handler: destroy unless it vetoed. */
  async function finish(event: CloseRequestedEvent) {
    if (event.isPreventDefault()) return
    if (!bridge.allowDestroy()) throw new Error('core:window:allow-destroy not granted')
    bridge.destroyed = true
    // Last window destroyed → ExitRequested { code: None } → veto + app-exit-requested.
    bridge.listeners
      .find((listener) => listener.name === 'app-exit-requested')
      ?.handler({
        payload: null,
      })
  }
  return {
    getCurrentWindow: () => ({
      isMaximized: async () => false,
      onResized: async () => () => undefined,
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      close: () => bridge.deliver?.(),
      destroy: async () => {
        if (!bridge.allowDestroy()) throw new Error('core:window:allow-destroy not granted')
        bridge.destroyed = true
      },
      onCloseRequested: async (handler: (event: CloseRequestedEvent) => void | Promise<void>) => {
        bridge.deliver = async () => {
          const event = new CloseRequestedEvent()
          await handler(event)
          await finish(event)
        }
        return () => {
          bridge.deliver = undefined
        }
      },
    }),
  }
})

function grantsDestroy(): boolean {
  const capability = JSON.parse(
    readFileSync(new URL('../../src-tauri/capabilities/default.json', import.meta.url), 'utf8'),
  ) as { permissions: string[] }
  return capability.permissions.includes('core:window:allow-destroy')
}

beforeEach(() => {
  bridge.exited = false
  bridge.destroyed = false
  bridge.deliver = undefined
  bridge.listeners = []
  bridge.allowDestroy = grantsDestroy
  setActivePinia(createPinia())
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
})

function arm() {
  const harness = mount(
    defineComponent({
      setup() {
        useFileExit()
        return () => null
      },
    }),
  )
  return harness
}

it('quits when macOS sends the traffic-light close', async () => {
  const harness = arm()
  await vi.waitFor(() => expect(bridge.deliver).toEqual(expect.any(Function)))
  await bridge.deliver?.()
  await vi.waitFor(() => expect(bridge.exited).toBe(true))
  harness.unmount()
})

it('quits when the Windows title-bar X is clicked', async () => {
  const harness = arm()
  await vi.waitFor(() => expect(bridge.deliver).toEqual(expect.any(Function)))
  const controls = mount(WindowControls)
  await controls.get('[aria-label="Fermer"]').trigger('click')
  await vi.waitFor(() => expect(bridge.exited).toBe(true))
  controls.unmount()
  harness.unmount()
})

it('keeps the window open while a document is still saving', async () => {
  const harness = arm()
  await vi.waitFor(() => expect(bridge.deliver).toEqual(expect.any(Function)))
  useFiles()
    .state('tab')
    .documents.push({ saving: true } as RemoteDocument)
  await bridge.deliver?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(bridge.exited).toBe(false)
  expect(bridge.destroyed).toBe(false)
  harness.unmount()
})
