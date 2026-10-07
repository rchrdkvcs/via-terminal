import { describe, expect, it } from 'vitest'
import { PIXEL_SIZE, THRESHOLD, createSwipeTracker, spring, type Pan } from './swipeTracker'

/** Replays phased pans and returns what the sidebar was told. */
function replay(pans: Pan[], { spaces = 3 } = {}) {
  const moves: number[] = []
  const ends: Array<{ commit: 1 | -1 | 0; velocity: number }> = []
  let crossings = 0
  let begins = 0
  const feed = createSwipeTracker({
    canSwipe: () => spaces > 1,
    begin: () => begins++,
    move: (amount) => moves.push(amount),
    cross: () => crossings++,
    commit: (direction, velocity) => ends.push({ commit: direction, velocity }),
    cancel: (velocity) => ends.push({ commit: 0, velocity }),
  })
  pans.forEach(feed)
  return { moves, ends, crossings, begins, commits: ends.map((e) => e.commit) }
}

/** Fingers on the touchpad: `count` events of `step` px, 16 ms apart, then the lift. */
function swipe(step: number, count: number, { start = 0, lift = 0 } = {}): Pan[] {
  const pans: Pan[] = Array.from({ length: count }, (_, i) => ({
    phase: i === 0 ? 'start' : 'update',
    dx: step,
    dy: 0,
    t: start + i * 16,
  }))
  pans.push({ phase: 'end', dx: lift, dy: 0, t: start + count * 16 })
  return pans
}

/** A drag held still before the lift, so it ends without speed. */
function held(step: number, count: number): Pan[] {
  const pans = swipe(step, count)
  const end = pans.pop()!
  pans.push({ phase: 'update', dx: 0, dy: 0, t: end.t + 100 })
  pans.push({ ...end, t: end.t + 116 })
  return pans
}

describe('swipe tracker', () => {
  it('measures the swipe in whole swipes of finger travel', () => {
    const { moves } = replay(swipe(55, 2))
    expect(moves[0]).toBeCloseTo(55 / PIXEL_SIZE)
    expect(moves[1]).toBeCloseTo(110 / PIXEL_SIZE)
  })

  it('switches on a slow drag past the threshold', () => {
    const travel = PIXEL_SIZE * THRESHOLD + 20
    expect(replay(held(travel / 10, 10)).commits).toEqual([1])
    expect(replay(held(-travel / 10, 10)).commits).toEqual([-1])
  })

  it('springs back from a slow drag short of it', () => {
    const travel = PIXEL_SIZE * THRESHOLD - 20
    expect(replay(held(travel / 10, 10)).commits).toEqual([0])
  })

  it('switches on a short, fast flick', () => {
    // 60 px, well short of the threshold, at about 1.9 px/ms.
    const { commits, moves } = replay(swipe(30, 2))
    expect(Math.max(...moves)).toBeLessThan(THRESHOLD)
    expect(commits).toEqual([1])
  })

  it('cancels when the fingers come back before lifting, however far it went', () => {
    const pans = [...swipe(30, 10).slice(0, -1), ...swipe(-2, 2, { start: 160 }).slice(1)]
    expect(replay(pans).commits).toEqual([0])
  })

  it('never goes past its start the other way', () => {
    const pans = [...swipe(10, 3).slice(0, -1), ...swipe(-20, 4, { start: 48 }).slice(1)]
    const { moves } = replay(pans)
    expect(Math.min(...moves)).toBe(0)
  })

  it('never shows a swipe that would cancel as past the threshold', () => {
    const pans = [...swipe(40, 6).slice(0, -1), ...swipe(-1, 2, { start: 96 }).slice(1)]
    const { moves } = replay(pans)
    expect(moves[moves.length - 1]).toBeLessThan(THRESHOLD)
  })

  it('reports each crossing of the threshold, for the haptic bump', () => {
    const pans = [...swipe(40, 6).slice(0, -1), ...swipe(-1, 2, { start: 96 }).slice(1)]
    expect(replay(pans).crossings).toBe(2)
  })

  it('hands the speed of the fingers to the spring', () => {
    const { ends } = replay(swipe(-11, 10))
    // 11 px per 16 ms is one swipe per second.
    expect(ends[0].velocity).toBeCloseTo((-11 / PIXEL_SIZE) * (1000 / 16))
  })

  it('springs back when the OS cancels the gesture', () => {
    const pans = swipe(40, 6)
    pans[pans.length - 1].phase = 'cancel'
    expect(replay(pans).commits).toEqual([0])
  })

  it('ignores swipes when there is no other space', () => {
    const { begins, ends } = replay(swipe(40, 10), { spaces: 1 })
    expect(begins).toBe(0)
    expect(ends).toEqual([])
  })

  it('takes swipes one after the other, either way', () => {
    const pans = [
      ...swipe(30, 10),
      ...swipe(-30, 10, { start: 400 }),
      ...swipe(30, 10, { start: 800 }),
    ]
    expect(replay(pans).commits).toEqual([1, -1, 1])
  })
})

describe('spring', () => {
  it('comes to rest at 0 without overshooting', () => {
    const curve = spring(-1, 0, 37)
    const samples = Array.from({ length: 30 }, (_, i) => curve(i / 60).position)
    expect(samples.every((p) => p <= 0)).toBe(true)
    expect(Math.abs(curve(0.25).position)).toBeLessThan(0.01)
  })

  it('starts with the speed it is given', () => {
    const curve = spring(0.5, -3, 16)
    expect(curve(0).position).toBe(0.5)
    expect(curve(0).velocity).toBe(-3)
  })
})
