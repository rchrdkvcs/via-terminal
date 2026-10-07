import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSpaces } from '@/stores/spaces'
import { useSpaceTrack } from './useSpaceTrack'

vi.mock('@/ipc/client', () => ({
  api: { saveLayout: async () => undefined },
  isNative: () => false,
  describeError: String,
  errorCode: () => null,
}))

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const FRAME = 16

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), FRAME),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})

function track(reduce = false) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  setActivePinia(createPinia())
  const spaces = useSpaces()
  const space = (id: string) => ({ id, name: id, icon: 'terminal', defaultShell: null, pinned: [] })
  spaces.hydrate({
    activeSpaceId: 'one',
    sidebar: { visible: true, width: 264 },
    spaces: [space('one'), space('two'), space('three')],
  })
  let result!: ReturnType<typeof useSpaceTrack>
  mount(
    defineComponent({
      setup() {
        result = useSpaceTrack(ref())
        return () => null
      },
    }),
  )
  return { spaces, ...result }
}

function wheel(deltaX: number, options: { ctrlKey?: boolean; deltaY?: number } = {}) {
  return {
    deltaX,
    deltaY: options.deltaY ?? 0,
    deltaMode: 0,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: false,
    preventDefault: () => undefined,
  }
}

/** Two-finger swipe of `steps` wheel events of `dx` pixels, `every` ms apart, then lifts. */
function swipe(onWheel: (event: ReturnType<typeof wheel>) => void, dx: number, every: number) {
  for (let step = 0; step < 5; step += 1) {
    onWheel(wheel(dx))
    vi.advanceTimersByTime(every)
  }
}

/** Offset of `id`, in widths: 0 in place, 1 one width to the right. */
function offset(place: (id: string) => string | null, id: string): number | null {
  const transform = place(id)
  if (transform === null || transform === 'none') return transform === 'none' ? 0 : null
  return Number(/translateX\((-?[\d.e-]+)%\)/.exec(transform)![1]) / 100
}

describe('space track', () => {
  it('rests with only the active space shown', () => {
    const { place, moving } = track()
    expect(place('one')).toBe('none')
    expect(place('two')).toBeNull()
    expect(moving.value).toBe(false)
  })

  it('slides the next space in on a stepped switch, then rests', () => {
    const { spaces, onWheel, place, moving } = track()
    onWheel(wheel(0, { ctrlKey: true, deltaY: 60 }))
    expect(spaces.activeId).toBe('two')
    expect(moving.value).toBe(true)
    expect(offset(place, 'two')).toBeCloseTo(1)
    expect(offset(place, 'one')).toBeCloseTo(0)

    vi.advanceTimersByTime(FRAME * 3)
    const sliding = offset(place, 'two')!
    expect(sliding).toBeGreaterThan(0)
    expect(sliding).toBeLessThan(1)

    vi.advanceTimersByTime(2000)
    expect(moving.value).toBe(false)
    expect(place('two')).toBe('none')
    expect(place('one')).toBeNull()
  })

  it('follows the fingers and springs back when the swipe is too short', () => {
    const { spaces, onWheel, place, moving } = track()
    onWheel(wheel(5))
    vi.advanceTimersByTime(50)
    onWheel(wheel(5))
    expect(moving.value).toBe(true)
    expect(offset(place, 'one')!).toBeLessThan(0)
    expect(offset(place, 'two')!).toBeGreaterThan(0)

    vi.advanceTimersByTime(2000)
    expect(spaces.activeId).toBe('one')
    expect(moving.value).toBe(false)
    expect(place('one')).toBe('none')
  })

  it('switches on a long enough swipe and keeps its momentum', () => {
    const arrival = (every: number) => {
      const { spaces, onWheel, place } = track()
      swipe(onWheel, 40, every)
      vi.advanceTimersByTime(100 - every)
      expect(spaces.activeId).toBe('two')
      const start = offset(place, 'two')!
      vi.advanceTimersByTime(FRAME)
      return { start, next: offset(place, 'two')! }
    }
    const slow = arrival(50)
    const fast = arrival(8)
    expect(fast.start).toBeCloseTo(slow.start)
    expect(slow.next).toBeGreaterThan(0)
    expect(fast.next).toBeLessThan(slow.next)
  })

  it('switches without sliding when motion is reduced', () => {
    const { spaces, onWheel, place, moving } = track(true)
    onWheel(wheel(0, { ctrlKey: true, deltaY: 60 }))
    expect(spaces.activeId).toBe('two')
    expect(moving.value).toBe(false)
    expect(place('two')).toBe('none')
    expect(place('one')).toBeNull()
  })
})
