import { describe, expect, it } from 'vitest'
import { RELEASE_GAP, createSpaceSwipe, rubberBand } from './spaceSwipe'

const WIDTH = 264

interface Step {
  t: number
  dx: number
  dy?: number
  ctrl?: boolean
  shift?: boolean
}

/**
 * Replays wheel events at given timestamps on a fake clock that also fires
 * the release timer; returns what the sidebar was told.
 */
function replay(events: Step[], { spaces = 3, resume = 0 } = {}) {
  let clock = 0
  let timer: { at: number; run: () => void } | null = null
  const drags: number[] = []
  const releases: number[] = []
  const steps: number[] = []
  const prevented: boolean[] = []
  const onWheel = createSpaceSwipe(
    {
      width: () => WIDTH,
      canSwitch: () => spaces > 1,
      resume: () => resume,
      drag: (offset) => drags.push(offset),
      release: (direction) => releases.push(direction),
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
  return { drags, releases, steps, prevented }
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

describe('space swipe', () => {
  it('follows the fingers one to one', () => {
    const { drags } = replay(fingers(0, 10, 5))
    expect(drags).toEqual([10, 20, 30, 40, 50])
  })

  it('starts the drag from where a settling space stands', () => {
    const { drags } = replay(fingers(0, 10, 2), { resume: -100 })
    expect(drags).toEqual([-90, -80])
  })

  it('switches once per trackpad swipe, inertia included', () => {
    expect(replay(swipe(1000, 1)).releases).toEqual([1])
  })

  it('stops following once the inertia shows', () => {
    const { drags } = replay(swipe(1000, 1))
    // Eighteen finger events, then the few shrinking ones it takes to read inertia.
    expect(drags.length).toBeLessThan(18 + 6)
    expect(Math.max(...drags)).toBeLessThanOrEqual(WIDTH)
  })

  it('switches again on a second, separate swipe, either way', () => {
    expect(replay([...swipe(1000, 1), ...swipe(3000, -1), ...swipe(5000, -1)]).releases).toEqual([
      1, -1, -1,
    ])
  })

  it('takes a new swipe that lands while the last inertia still runs', () => {
    const first = [...fingers(0, 28, 14), ...inertia(14 * 16, 28, 0.96, 25)]
    const second = fingers(first[first.length - 1].t + 16, 28, 14)
    expect(replay([...first, ...second]).releases).toEqual([1, 1])
  })

  it('takes a reversed swipe that lands while the last inertia still runs', () => {
    const first = [...fingers(0, 28, 14), ...inertia(14 * 16, 28, 0.96, 25)]
    const second = fingers(first[first.length - 1].t + 16, -28, 14)
    expect(replay([...first, ...second]).releases).toEqual([1, -1])
  })

  it('springs back from a short drag', () => {
    expect(replay(fingers(0, 8, 4)).releases).toEqual([0])
  })

  it('switches on a released drag past a quarter of the width', () => {
    // 70 px of 264, held still, then lifted: no inertia, distance alone decides.
    expect(replay(fingers(0, 10, 7)).releases).toEqual([1])
  })

  it('switches on a short, fast flick', () => {
    // 36 px of fingers and about 20 px of inertia: well short of a quarter.
    const flick = [...fingers(0, -12, 3), ...inertia(48, -12, 0.7, 10)]
    const { drags, releases } = replay(flick)
    expect(Math.abs(drags[drags.length - 1])).toBeLessThan(WIDTH * 0.25)
    expect(releases).toEqual([-1])
  })

  it('springs back from the same short drag made slowly', () => {
    const slow = [...fingers(0, -4, 9), ...inertia(144, -4, 0.7, 10)]
    expect(replay(slow).releases).toEqual([0])
  })

  it('springs back when the fingers come back before lifting', () => {
    const back = [...fingers(0, 10, 9), ...fingers(144, -10, 8)]
    expect(replay(back).releases).toEqual([0])
  })

  it('releases after a silence', () => {
    const { releases } = replay([{ t: 0, dx: 10 }])
    expect(releases).toEqual([0])
    expect(RELEASE_GAP).toBeLessThanOrEqual(120)
  })

  it('resists past the last space when there is no other one', () => {
    const { drags, releases } = replay(fingers(0, 30, 10), { spaces: 1 })
    expect(Math.max(...drags)).toBeLessThan(WIDTH * 0.15)
    expect(releases).toEqual([0])
    expect(rubberBand(-1000, WIDTH)).toBeGreaterThan(-WIDTH * 0.15)
  })

  it('switches once per mouse wheel notch with Ctrl or Shift', () => {
    const { steps, drags } = replay([
      { t: 1000, dx: 0, dy: 100, ctrl: true },
      { t: 1400, dx: 0, dy: 100, ctrl: true },
      { t: 1800, dx: -100, dy: 0, shift: true },
    ])
    expect(steps).toEqual([1, 1, -1])
    expect(drags).toEqual([])
  })

  it('ignores vertical scrolling and lets the list scroll', () => {
    const { drags, releases, prevented } = replay([{ t: 0, dx: 2, dy: 40 }])
    expect(drags).toEqual([])
    expect(releases).toEqual([])
    expect(prevented).toEqual([false])
  })

  it('keeps swiping when the fingers drift vertically mid-swipe', () => {
    const { drags, prevented } = replay([
      { t: 0, dx: 20 },
      { t: 16, dx: 2, dy: 10 },
    ])
    expect(drags).toEqual([20, 22])
    expect(prevented).toEqual([true, true])
  })

  it('hands a vertical scroll right after a swipe to the list', () => {
    const first = [...fingers(0, 28, 14), ...inertia(14 * 16, 28, 0.96, 10)]
    const { prevented } = replay([...first, { t: first[first.length - 1].t + 16, dx: 0, dy: 30 }])
    expect(prevented[prevented.length - 1]).toBe(false)
  })
})
