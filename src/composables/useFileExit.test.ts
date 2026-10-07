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
 * listener then calls `destroy()` unless the handler vetoed too, and the
 * capability denies `destroy`. The only exit the process handler lets
 * through is `app_exit` (code Some).
 */
const bridge = vi.hoisted(() => ({
  exited: false,
  deliver: undefined as (() => Promise<void>) | undefined,
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
  listen: vi.fn(async () => () => undefined),
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
  return {
    getCurrentWindow: () => ({
      isMaximized: async () => false,
      onResized: async () => () => undefined,
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      close: () => bridge.deliver?.(),
      onCloseRequested: async (handler: (event: CloseRequestedEvent) => void | Promise<void>) => {
        bridge.deliver = async () => {
          const event = new CloseRequestedEvent()
          await handler(event)
          // What `@tauri-apps/api` does next; the capability denies it.
          if (!event.isPreventDefault()) throw new Error('core:window:allow-destroy not granted')
        }
        return () => {
          bridge.deliver = undefined
        }
      },
    }),
  }
})

beforeEach(() => {
  bridge.exited = false
  bridge.deliver = undefined
  setActivePinia(createPinia())
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
})

function arm() {
  return mount(
    defineComponent({
      setup() {
        useFileExit()
        return () => null
      },
    }),
  )
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
  harness.unmount()
})
