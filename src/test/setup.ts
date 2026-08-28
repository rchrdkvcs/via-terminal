import { vi } from 'vitest'

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  },
  writable: true,
})
