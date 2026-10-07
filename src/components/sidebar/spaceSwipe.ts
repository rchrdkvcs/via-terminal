type Wheel = Pick<
  WheelEvent,
  'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'shiftKey' | 'preventDefault'
>

/** Share of the sidebar width a released drag must cover to switch. */
export const COMMIT = 0.25
/** Speed, in px/ms, at which a shorter drag still switches when the fingers leave moving. */
const FLICK = 0.6
/** Below this distance even a fast flick springs back. */
const FLICK_MIN = 12
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

export interface SwipeTarget {
  /** Width of one space: the distance of a whole switch. */
  width(): number
  /** Whether there is another space to swipe to; without one the drag resists. */
  canSwitch(): boolean
  /** Where the spaces stand when fingers land, so a swipe can catch a settling one. */
  resume(): number
  /** The spaces follow the fingers by `offset` px; positive reveals the next space. */
  drag(offset: number): void
  /** The fingers left: switch towards `direction`, or spring back on 0. */
  release(direction: 1 | -1 | 0): void
  /** A mouse notch with Ctrl or Shift held: switch at once. */
  step(direction: 1 | -1): void
}

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

/** Pulls past the last space shrink the further they go, like a rubber band. */
export function rubberBand(travel: number, width: number): number {
  const limit = width * 0.15
  return Math.sign(travel) * limit * (1 - 1 / (Math.abs(travel) / limit + 1))
}

/**
 * Turns wheel events into a swipe between spaces, the way Arc does it.
 *
 * Wheel events carry no touchpad phases, so the gesture is read from its
 * rhythm: a clearly horizontal delta starts a drag that follows the fingers
 * 1:1; the fingers have left once the events fall silent for `RELEASE_GAP` or
 * start shrinking steadily, which is inertia. Inertia never drags and never
 * switches; it is swallowed until it settles, or until fresh fingers show up
 * as a delta that jumps back up or turns around. One gesture switches at most
 * once. Ctrl or Shift with the wheel steps one space per notch instead.
 */
export function createSpaceSwipe(target: SwipeTarget, clock: Clock = realClock) {
  let mode: 'idle' | 'drag' | 'coast' = 'idle'
  let travel = 0
  let offset = 0
  /** Smoothed speed in px/ms; `null` until the swipe's first event. */
  let velocity: number | null = null
  /** The fingers' speed when the inertia took over. */
  let launch = 0
  let previous = 0
  let peak = 0
  let shrinking = 0
  let direction = 0
  let last = -Infinity
  let cancelGap = () => {}

  let stepLast = -Infinity
  let stepTravel = 0
  let stepLocked = false

  function release(byInertia: boolean) {
    const reach = target.width() * COMMIT
    const flick = byInertia && Math.abs(launch) >= FLICK && Math.sign(launch) === Math.sign(offset)
    const commits =
      target.canSwitch() && (Math.abs(offset) >= reach || (flick && Math.abs(offset) >= FLICK_MIN))
    target.release(commits ? (Math.sign(offset) as 1 | -1) : 0)
    mode = byInertia ? 'coast' : 'idle'
  }

  function start() {
    mode = 'drag'
    travel = target.resume()
    velocity = null
    launch = 0
    peak = 0
    previous = 0
    shrinking = 0
  }

  function follow(delta: number, elapsed: number) {
    const size = Math.abs(delta)
    shrinking = size < previous ? shrinking + 1 : 0
    if (shrinking === 1) launch = velocity ?? 0
    previous = size
    peak = Math.max(peak, size)
    // The first event of a swipe has no previous one to time it against.
    const speed = delta / (elapsed > RELEASE_GAP ? 16 : Math.max(elapsed, 1))
    velocity = velocity === null ? speed : 0.6 * speed + 0.4 * velocity
    direction = Math.sign(delta)

    const width = target.width()
    travel = Math.max(-width, Math.min(width, travel + delta))
    offset = target.canSwitch() ? travel : rubberBand(travel, width)
    target.drag(offset)
    if (shrinking >= DECAY_RUN && size < peak * 0.7) release(true)
  }

  /** In inertia, fresh fingers show as a delta that jumps back up or turns around. */
  function freshFingers(delta: number) {
    const size = Math.abs(delta)
    if (size < RISE_MIN) return false
    return Math.sign(delta) !== direction || size > previous * RISE
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
    target.step(stepTravel > 0 ? 1 : -1)
  }

  return function onWheel(event: Wheel) {
    const unit = event.deltaMode === 1 ? LINE : 1
    const dx = event.deltaX * unit
    const dy = event.deltaY * unit
    if (event.ctrlKey || event.shiftKey) {
      stepWheel(event, Math.abs(dx) > Math.abs(dy) ? dx : dy)
      return
    }

    const t = clock.now()
    const elapsed = t - last
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5
    if (mode !== 'idle' && elapsed > RELEASE_GAP) {
      if (mode === 'drag') release(false)
      mode = 'idle'
    }

    if (mode === 'idle') {
      if (!horizontal) return
      start()
    } else if (mode === 'coast') {
      // A vertical scroll right after a swipe belongs to the list.
      if (!horizontal && Math.abs(dy) > Math.abs(dx)) {
        mode = 'idle'
        return
      }
      if (freshFingers(dx)) start()
      else {
        previous = Math.abs(dx)
        direction = Math.sign(dx) || direction
      }
    }

    // The axis is locked for the whole gesture: a drifting finger keeps swiping.
    event.preventDefault()
    last = t
    if (mode === 'drag') follow(dx, elapsed)
    cancelGap()
    cancelGap = clock.later(() => {
      if (mode === 'drag') release(false)
      mode = 'idle'
    }, RELEASE_GAP)
  }
}
