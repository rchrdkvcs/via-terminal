import { describe, expect, it } from 'vitest'
import { createSwipeTracker, type Pan } from './swipeTracker'
import { createWheelPan } from './wheelPan'

interface Step {
  t: number
  dx: number
  dy?: number
  ctrl?: boolean
  shift?: boolean
}

/**
 * Replays wheel events on a fake clock that also fires the release timer,
 * through the swipe tracker; returns what the sidebar was told.
 */
function replay(events: Step[], { phased = false } = {}) {
  let clock = 0
  let timer: { at: number; run: () => void } | null = null
  const pans: Pan['phase'][] = []
  const commits: number[] = []
  const steps: number[] = []
  const prevented: boolean[] = []
  const feed = createSwipeTracker({
    canSwipe: () => true,
    begin: () => {},
    move: () => {},
    cross: () => {},
    commit: (direction) => commits.push(direction),
    cancel: () => commits.push(0),
  })
  const onWheel = createWheelPan(
    {
      phased,
      pan: (pan) => {
        pans.push(pan.phase)
        feed(pan)
      },
      step: (direction) => steps.push(direction),
    },
    {
      now: () => clock,
      later: (run, ms) => {
        const pending = { at: clock + ms, run }
        timer = pending
        return () => {
          if (timer === pending) timer = null
        }
      },
    },
  )
  const advance = (to: number) => {
    while (timer && timer.at <= to) {
      const due: { at: number; run: () => void } = timer
      timer = null
      clock = due.at
      due.run()
    }
    clock = to
  }
  for (const e of events) {
    advance(e.t)
    let cancelled = false
    onWheel({
      deltaX: e.dx,
      deltaY: e.dy ?? 0,
      deltaMode: 0,
      ctrlKey: !!e.ctrl,
      shiftKey: !!e.shift,
      preventDefault: () => (cancelled = true),
    })
    prevented.push(cancelled)
  }
  advance(clock + 1000)
  return { pans, commits, steps, prevented }
}

/** Finger motion: `count` events of `step` px, 16 ms apart. */
function fingers(start: number, step: number, count: number): Step[] {
  return Array.from({ length: count }, (_, i) => ({ t: start + i * 16, dx: step }))
}

/** Inertia after the fingers leave: a tail that decays until it fades. */
function inertia(start: number, from: number, decay = 0.93, count = 60): Step[] {
  return Array.from({ length: count }, (_, i) => ({
    t: start + i * 16,
    dx: Math.sign(from) * Math.max(Math.abs(from) * Math.pow(decay, i + 1), 0.5),
  }))
}

/** A whole trackpad swipe: ~300 ms of fingers, then ~1 s of inertia. */
function swipe(start: number, sign: 1 | -1): Step[] {
  return [...fingers(start, sign * 30, 18), ...inertia(start + 18 * 16, sign * 30)]
}

describe('wheel swipes', () => {
  it('switches once per trackpad swipe, inertia included', () => {
    const { commits, pans } = replay(swipe(1000, 1))
    expect(commits).toEqual([1])
    expect(pans.filter((p) => p === 'start')).toHaveLength(1)
  })

  it('switches again on a second, separate swipe, either way', () => {
    const { commits } = replay([...swipe(1000, 1), ...swipe(3000, -1), ...swipe(5000, -1)])
    expect(commits).toEqual([1, -1, -1])
  })

  it('takes a new swipe that lands while the last inertia still runs', () => {
    const first = [...fingers(0, 28, 14), ...inertia(14 * 16, 28, 0.96, 25)]
    const second = fingers(first[first.length - 1].t + 16, 28, 14)
    expect(replay([...first, ...second]).commits).toEqual([1, 1])
  })

  it('takes a reversed swipe that lands while the last inertia still runs', () => {
    const first = [...fingers(0, 28, 14), ...inertia(14 * 16, 28, 0.96, 25)]
    const second = fingers(first[first.length - 1].t + 16, -28, 14)
    expect(replay([...first, ...second]).commits).toEqual([1, -1])
  })

  it('springs back from a short, slow drag', () => {
    expect(replay(fingers(0, 3, 4)).commits).toEqual([0])
  })

  it('switches once per mouse wheel notch with Ctrl or Shift', () => {
    const { steps, pans } = replay([
      { t: 1000, dx: 0, dy: 100, ctrl: true },
      { t: 1400, dx: 0, dy: 100, ctrl: true },
      { t: 1800, dx: -100, dy: 0, shift: true },
    ])
    expect(steps).toEqual([1, 1, -1])
    expect(pans).toEqual([])
  })

  it('leaves touchpad swipes to the OS where it phases them', () => {
    const { pans, prevented, steps } = replay(
      [...swipe(0, 1), { t: 5000, dx: 0, dy: 100, ctrl: true }],
      { phased: true },
    )
    expect(pans).toEqual([])
    expect(prevented.slice(0, -1).every((p) => !p)).toBe(true)
    expect(steps).toEqual([1])
  })

  it('ignores vertical scrolling and lets the list scroll', () => {
    const { pans, prevented } = replay([{ t: 0, dx: 2, dy: 40 }])
    expect(pans).toEqual([])
    expect(prevented).toEqual([false])
  })

  it('keeps swiping when the fingers drift vertically mid-swipe', () => {
    const { pans, prevented } = replay([
      { t: 0, dx: 20 },
      { t: 16, dx: 2, dy: 10 },
    ])
    expect(pans).toEqual(['start', 'update', 'end'])
    expect(prevented).toEqual([true, true])
  })

  it('hands a vertical scroll right after a swipe to the list', () => {
    const first = [...fingers(0, 28, 14), ...inertia(14 * 16, 28, 0.96, 10)]
    const { prevented } = replay([...first, { t: first[first.length - 1].t + 16, dx: 0, dy: 30 }])
    expect(prevented[prevented.length - 1]).toBe(false)
  })
})
