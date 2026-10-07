import type { Pan } from './swipeTracker'

type Wheel = Pick<
  WheelEvent,
  'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'shiftKey' | 'preventDefault'
>

/** Silence that tells the fingers left the touchpad (or the inertia settled). */
export const RELEASE_GAP = 100
/** Shrinking deltas in a row that read as inertia rather than fingers. */
const DECAY_RUN = 4
/** During inertia, a delta this much larger than the last one is fresh fingers. */
const RISE = 1.6
const RISE_MIN = 4
/** Mouse notches: travel before a step, and the silence that ends a burst. */
const STEP_TRAVEL = 40
const STEP_IDLE = 160
const LINE = 16

export interface Clock {
  now(): number
  later(run: () => void, ms: number): () => void
}

const realClock: Clock = {
  now: () => performance.now(),
  later: (run, ms) => {
    const id = setTimeout(run, ms)
    return () => clearTimeout(id)
  },
}

export interface WheelPanOptions {
  /** Where touchpad swipes come phased from the OS, wheels only step. */
  phased: boolean
  pan(pan: Pan): void
  /** A mouse notch with Ctrl or Shift held: switch at once. */
  step(direction: 1 | -1): void
}

/**
 * Wheel events over the sidebar, turned into swipe phases where the OS gives
 * none (Windows, Linux, a plain browser).
 *
 * Wheel events carry no touchpad phases, so they are guessed from the
 * rhythm: a clearly horizontal delta starts a swipe; the fingers have left
 * once the events fall silent for `RELEASE_GAP` or start shrinking steadily,
 * which is inertia. Inertia is swallowed until it settles, or until fresh
 * fingers show up as a delta that jumps back up or turns around. Ctrl or
 * Shift with the wheel steps one space per notch instead, everywhere.
 */
export function createWheelPan(options: WheelPanOptions, clock: Clock = realClock) {
  let mode: 'idle' | 'swipe' | 'coast' = 'idle'
  let previous = 0
  let peak = 0
  let shrinking = 0
  let direction = 0
  let cancelGap = () => {}

  let stepLast = -Infinity
  let stepTravel = 0
  let stepLocked = false

  function lift() {
    if (mode === 'swipe') options.pan({ phase: 'end', dx: 0, dy: 0, t: clock.now() })
  }

  function stepWheel(event: Wheel, delta: number) {
    event.preventDefault()
    const t = clock.now()
    if (t - stepLast > STEP_IDLE) {
      stepTravel = 0
      stepLocked = false
    }
    stepLast = t
    if (stepLocked) return
    // A reversal mid-burst starts the count over.
    stepTravel = Math.sign(delta) === Math.sign(stepTravel) ? stepTravel + delta : delta
    if (Math.abs(stepTravel) < STEP_TRAVEL) return
    stepLocked = true
    options.step(stepTravel > 0 ? 1 : -1)
  }

  /** In inertia, fresh fingers show as a delta that jumps back up or turns around. */
  function freshFingers(delta: number) {
    const size = Math.abs(delta)
    if (size < RISE_MIN) return false
    return Math.sign(delta) !== direction || size > previous * RISE
  }

  return function onWheel(event: Wheel) {
    const unit = event.deltaMode === 1 ? LINE : 1
    const dx = event.deltaX * unit
    const dy = event.deltaY * unit
    if (event.ctrlKey || event.shiftKey) {
      stepWheel(event, Math.abs(dx) > Math.abs(dy) ? dx : dy)
      return
    }
    if (options.phased) return

    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5
    let phase: Pan['phase'] = 'update'
    if (mode === 'idle') {
      if (!horizontal) return
      phase = 'start'
    } else if (mode === 'coast') {
      // A vertical scroll right after a swipe belongs to the list.
      if (!horizontal && Math.abs(dy) > Math.abs(dx)) {
        mode = 'idle'
        return
      }
      if (freshFingers(dx)) phase = 'start'
    }
    // The axis is locked for the whole gesture: a drifting finger keeps swiping.
    event.preventDefault()

    const size = Math.abs(dx)
    if (phase === 'start') {
      mode = 'swipe'
      peak = 0
      shrinking = 0
    } else {
      shrinking = size < previous ? shrinking + 1 : 0
    }
    previous = size
    direction = Math.sign(dx) || direction

    if (mode === 'swipe') {
      peak = Math.max(peak, size)
      options.pan({ phase, dx, dy, t: clock.now() })
      if (shrinking >= DECAY_RUN && size < peak * 0.7) {
        lift()
        mode = 'coast'
      }
    }
    cancelGap()
    cancelGap = clock.later(() => {
      lift()
      mode = 'idle'
    }, RELEASE_GAP)
  }
}
