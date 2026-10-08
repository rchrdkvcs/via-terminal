import type { TrackpadSwipeEvent } from '@/ipc/types'

export type Pan = TrackpadSwipeEvent

export const PIXEL_SIZE = 550

export const THRESHOLD = 0.25

const VELOCITY_CONTRIBUTION = 0.5

const TWITCH_TOLERANCE = 1e-7

const MIN_ELAPSED = 8

export interface SwipeSink {
  canSwipe(): boolean

  begin(): void

  move(amount: number): void

  cross(): void

  commit(direction: 1 | -1, velocity: number): void

  cancel(velocity: number): void
}

export function createSwipeTracker(sink: SwipeSink) {
  let tracking = false
  let direction: 1 | -1 | 0 = 0
  let amount = 0
  let velocity = 0
  let lastT = 0
  let success = false

  function succeeds(released: boolean): boolean {
    if (!direction) return false
    if (velocity * direction < -TWITCH_TOLERANCE) return false
    const reach = released ? amount + velocity * VELOCITY_CONTRIBUTION : amount
    return reach * direction >= THRESHOLD
  }

  function step(pan: Pan, first: boolean) {
    const delta = pan.dx / PIXEL_SIZE
    if (!direction && delta) direction = delta > 0 ? 1 : -1
    amount = direction > 0 ? clamp(amount + delta, 0, 1) : clamp(amount + delta, -1, 0)
    if (pan.phase !== 'end') {
      if (!first) velocity = delta / (Math.max(MIN_ELAPSED, pan.t - lastT) / 1000)
      lastT = pan.t
    }

    const now = succeeds(pan.phase === 'end')
    if (now !== success) {
      success = now
      sink.cross()
    }

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
