import { describe, expect, it } from 'vitest'
import { createSpaceSwipe } from './spaceSwipe'

/** Replays wheel events at given timestamps; returns the switches fired. */
function replay(events: { t: number; dx: number; dy?: number; ctrl?: boolean }[]) {
  let clock = 0
  const switches: number[] = []
  const onWheel = createSpaceSwipe(
    (d) => switches.push(d),
    () => clock,
  )
  for (const e of events) {
    clock = e.t
    onWheel({
      deltaX: e.dx,
      deltaY: e.dy ?? 0,
      deltaMode: 0,
      ctrlKey: !!e.ctrl,
      preventDefault() {},
    })
  }
  return switches
}

/** One trackpad swipe: ~300 ms of finger motion, then ~900 ms of inertia. */
function trackpadSwipe(start: number, sign: 1 | -1) {
  const events = []
  for (let i = 0; i < 75; i++) {
    const dx = i < 18 ? 30 : 30 * Math.pow(0.93, i - 18)
    events.push({ t: start + i * 16, dx: sign * Math.max(dx, 0.5) })
  }
  return events
}

describe('space swipe', () => {
  it('switches once per trackpad swipe, inertia included', () => {
    expect(replay(trackpadSwipe(1000, 1))).toEqual([1])
  })

  it('switches again on a second, separate swipe', () => {
    expect(replay([...trackpadSwipe(1000, 1), ...trackpadSwipe(2600, -1)])).toEqual([1, -1])
  })

  it('switches once per mouse wheel notch', () => {
    expect(
      replay([
        { t: 1000, dx: 0, dy: 100, ctrl: true },
        { t: 1400, dx: 0, dy: 100, ctrl: true },
      ]),
    ).toEqual([1, 1])
  })

  it('waits for the swipe to travel before switching', () => {
    expect(
      replay([
        { t: 0, dx: 6 },
        { t: 16, dx: 6 },
      ]),
    ).toEqual([])
  })

  it('ignores vertical scrolling', () => {
    expect(replay([{ t: 0, dx: 2, dy: 40 }])).toEqual([])
  })
})
