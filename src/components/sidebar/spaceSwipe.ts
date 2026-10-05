type Wheel = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'preventDefault'>

/** Distance a gesture travels before it switches space, in pixels. */
const THRESHOLD = 40
/** Silence that ends a gesture. Trackpad inertia keeps firing until it settles. */
const IDLE = 160
const LINE = 16

/**
 * Turns wheel events into space switches: a horizontal swipe, or Ctrl with
 * the wheel. One gesture switches at most once; the lock holds while events
 * keep coming, inertia included, and lifts after `IDLE` ms of silence.
 */
export function createSpaceSwipe(
  onSwitch: (direction: 1 | -1) => void,
  now = () => performance.now(),
) {
  let last = -Infinity
  let travel = 0
  let locked = false

  return function onWheel(event: Wheel) {
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.5
    if (!event.ctrlKey && !horizontal) return
    event.preventDefault()

    const t = now()
    if (t - last > IDLE) {
      travel = 0
      locked = false
    }
    last = t
    if (locked) return

    const delta = (horizontal ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? LINE : 1)
    // A reversal mid-gesture starts the count over.
    travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta
    if (Math.abs(travel) < THRESHOLD) return
    locked = true
    onSwitch(travel > 0 ? 1 : -1)
  }
}
