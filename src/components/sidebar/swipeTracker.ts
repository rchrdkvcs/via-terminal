import type { TrackpadSwipeEvent } from '@/ipc/types'

/** One step of a touchpad swipe, as the OS phases it (or as wheel events are read). */
export type Pan = TrackpadSwipeEvent

/*
 * Values from Firefox's swipe tracker (widget/SwipeTracker.cpp and the
 * `widget.swipe.*` prefs), with the velocity weight Zen gives space swipes.
 */
/** Finger travel, in px, that makes a whole swipe. */
export const PIXEL_SIZE = 550
/** Share of a whole swipe that switches once the fingers lift. */
export const THRESHOLD = 0.25
/** Weight of the fingers' speed, in swipes per second, when they lift. */
const VELOCITY_CONTRIBUTION = 0.5
/** Fingers lifting while moving back, however slowly, cancel. */
const TWITCH_TOLERANCE = 1e-7
/** Shortest time an event is taken to cover, so a burst does not read as a fling. */
const MIN_ELAPSED = 8

export interface SwipeSink {
  /** Whether there is another space to swipe to; without one the gesture is ignored. */
  canSwipe(): boolean
  /** The fingers landed and the swipe is on. */
  begin(): void
  /** How far the swipe has gone, in whole swipes: positive towards the next space. */
  move(amount: number): void
  /** The swipe crossed its threshold, one way or the other. */
  cross(): void
  /** The fingers lifted past the threshold: switch, carrying their speed in swipes per second. */
  commit(direction: 1 | -1, velocity: number): void
  /** The fingers lifted short of it: spring back, carrying their speed. */
  cancel(velocity: number): void
}

/**
 * Follows a phased touchpad gesture the way Firefox does for Zen's spaces.
 *
 * The first movement sets the direction, and the swipe never goes past its
 * start the other way. Lifting the fingers switches when the distance, plus
 * the speed they left with, reaches `THRESHOLD`; moving back at the end always
 * cancels. Momentum after the lift is not a swipe and never reaches here.
 */
export function createSwipeTracker(sink: SwipeSink) {
  let tracking = false
  let direction: 1 | -1 | 0 = 0
  let amount = 0
  let velocity = 0
  let lastT = 0
  let success = false

  function succeeds(): boolean {
    if (!direction) return false
    if (velocity * direction < -TWITCH_TOLERANCE) return false
    return (amount + velocity * VELOCITY_CONTRIBUTION) * direction >= THRESHOLD
  }

  function step(pan: Pan, first: boolean) {
    const delta = pan.dx / PIXEL_SIZE
    if (!direction && delta) direction = delta > 0 ? 1 : -1
    amount = direction > 0 ? clamp(amount + delta, 0, 1) : clamp(amount + delta, -1, 0)
    if (pan.phase !== 'end') {
      if (!first) velocity = delta / (Math.max(MIN_ELAPSED, pan.t - lastT) / 1000)
      lastT = pan.t
    }

    const now = succeeds()
    if (now !== success) {
      success = now
      sink.cross()
    }
    // Short of switching, never look as if it would.
    const shown =
      !now && Math.abs(amount) >= THRESHOLD ? Math.sign(amount) * 0.999 * THRESHOLD : amount
    sink.move(shown)
  }

  return function feed(pan: Pan) {
    if (pan.phase === 'start') {
      tracking = sink.canSwipe()
      if (!tracking) return
      direction = 0
      amount = 0
      velocity = 0
      success = false
      sink.begin()
      step(pan, true)
      return
    }
    if (!tracking) return
    if (pan.phase === 'cancel') {
      tracking = false
      sink.cancel(0)
      return
    }
    step(pan, false)
    if (pan.phase !== 'end') return
    tracking = false
    if (success && direction) sink.commit(direction, velocity)
    else sink.cancel(velocity)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * A critically damped spring towards 0, in closed form: no bounce, and it
 * keeps whatever speed it is started with.
 */
export function spring(from: number, velocity: number, omega: number) {
  const b = velocity + omega * from
  return (seconds: number) => {
    const decay = Math.exp(-omega * seconds)
    return {
      position: (from + b * seconds) * decay,
      velocity: (velocity - omega * b * seconds) * decay,
    }
  }
}
