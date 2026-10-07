import type { Pan } from './swipeTracker'

type Wheel = Pick<
  WheelEvent,
  'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'shiftKey' | 'preventDefault'
>

export const RELEASE_GAP = 100

const DECAY_RUN = 4

const RISE = 1.6
const RISE_MIN = 4

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
  phased: boolean
  pan(pan: Pan): void

  step(direction: 1 | -1): void
}

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

    stepTravel = Math.sign(delta) === Math.sign(stepTravel) ? stepTravel + delta : delta
    if (Math.abs(stepTravel) < STEP_TRAVEL) return
    stepLocked = true
    options.step(stepTravel > 0 ? 1 : -1)
  }

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
      if (!horizontal && Math.abs(dy) > Math.abs(dx)) {
        mode = 'idle'
        return
      }
      if (freshFingers(dx)) phase = 'start'
    }

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
