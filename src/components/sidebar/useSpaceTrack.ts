import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { usePreferredReducedMotion, useResizeObserver } from '@vueuse/core'
import { api, isNative } from '@/ipc/client'
import { on } from '@/ipc/events'
import type { Id } from '@/ipc/types'
import { useSpaces } from '@/stores/spaces'
import { createSwipeTracker, spring } from './swipeTracker'
import { createWheelPan } from './wheelPan'

/** How far the spaces move per whole swipe, as Zen moves its strip. */
const GAIN = 1.5
/** A switch settles like Zen's 250 ms spring without bounce. */
const SWITCH_OMEGA = 37
/** A swipe let go short springs back like Firefox's (stiffness 250, mass 1). */
const RETURN_OMEGA = Math.sqrt(250)
/** Close enough to rest, in widths and widths per second. */
const REST = 0.0005
const REST_SPEED = 0.01

/** macOS phases touchpad gestures natively; elsewhere they are read from wheel events. */
const phased = isNative() && /Mac/.test(navigator.userAgent)

/**
 * The spaces as panels side by side on a horizontal track. Every panel stays
 * mounted, so the row under the pointer is never torn out mid-gesture; only
 * the active space and the one beside it are shown, moved by transforms.
 *
 * `position` is how far the track is pulled, in sidebar widths: positive
 * shows the next space coming in from the right. A swipe drives it directly;
 * a switch, from a swipe or anywhere else, restarts it from where the new
 * space stands and springs it to 0, keeping the speed the fingers left with.
 */
export function useSpaceTrack(sidebar: Ref<HTMLElement | undefined>) {
  const spaces = useSpaces()
  const motion = usePreferredReducedMotion()
  const reduced = computed(() => motion.value === 'reduce')
  const position = ref(0)
  /** The space shown beside the active one, and on which side. */
  const peer = ref<{ id: Id; side: 1 | -1 } | null>(null)
  const moving = ref(false)
  let frame = 0
  /** Where the track stood when the current swipe began. */
  let base = 0
  /** The speed a swipe hands to the switch it commits, in widths per second. */
  let fling = 0

  function neighbor(side: 1 | -1): Id | null {
    const list = spaces.spaces
    const index = list.findIndex((space) => space.id === spaces.active.id)
    const next = list[(index + side + list.length) % list.length]
    return next && next.id !== spaces.active.id ? next.id : null
  }

  function stop() {
    cancelAnimationFrame(frame)
    frame = 0
  }

  function rest() {
    stop()
    position.value = 0
    peer.value = null
    moving.value = false
  }

  /** Spring from where the track stands to the active space. */
  function settle(velocity: number, omega: number) {
    stop()
    if (reduced.value) return rest()
    const curve = spring(position.value, velocity, omega)
    const start = performance.now()
    const tick = (now: number) => {
      const at = curve((now - start) / 1000)
      if (Math.abs(at.position) < REST && Math.abs(at.velocity) < REST_SPEED) return rest()
      position.value = at.position
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  /** Pull the track to `at`, showing the neighbour on that side. */
  function pull(at: number) {
    if (reduced.value) return
    position.value = Math.max(-1, Math.min(1, at))
    const side = Math.sign(position.value) as 1 | -1 | 0
    const id = side ? neighbor(side) : null
    if (id && side) peer.value = { id, side }
  }

  const feed = createSwipeTracker({
    canSwipe: () => spaces.spaces.length > 1,
    begin: () => {
      // Catch a space mid-slide where it stands.
      stop()
      base = position.value
      moving.value = true
    },
    move: (amount) => pull(base + GAIN * amount),
    cross: () => {
      if (phased) api.swipeHaptic().catch(() => {})
    },
    commit: (direction, velocity) => {
      fling = GAIN * velocity
      spaces.cycle(direction)
    },
    cancel: (velocity) => settle(GAIN * velocity, RETURN_OMEGA),
  })

  const onWheel = createWheelPan({
    phased,
    pan: feed,
    step: (direction) => spaces.cycle(direction),
  })

  // Every switch slides, whatever started it: a swipe, a click, a shortcut.
  // Synchronously, so no frame shows the new space where the old one stood.
  watch(
    () => spaces.activeId,
    (_, old) => {
      const velocity = fling
      fling = 0
      if (reduced.value || !old || !spaces.byId(old)) return rest()
      // The new space stands a width further along than the old one did.
      const direction = spaces.switchDirection
      moving.value = true
      position.value -= direction
      peer.value = { id: old, side: -direction as 1 | -1 }
      settle(velocity, SWITCH_OMEGA)
    },
    { flush: 'sync' },
  )

  // Tell the OS where swipes may start, while there is somewhere to swipe to.
  let region = ''
  function report() {
    const rect = sidebar.value?.getBoundingClientRect()
    const next =
      rect && rect.width > 0 && spaces.spaces.length > 1
        ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
        : null
    const key = JSON.stringify(next)
    if (key === region) return
    region = key
    api.swipeRegion(next).catch(() => {})
  }

  let unlisten = () => {}
  if (phased) {
    useResizeObserver(sidebar, report)
    useResizeObserver(document.documentElement, report)
    watch(() => spaces.spaces.length, report)
    onMounted(() => {
      report()
      unlisten = on('trackpad-swipe', feed)
    })
  }

  onBeforeUnmount(() => {
    stop()
    unlisten()
    if (phased) api.swipeRegion(null).catch(() => {})
  })

  /** The transform of a space's panel, or `null` when it is out of sight. */
  function place(id: Id): string | null {
    const side = id === spaces.active.id ? 0 : peer.value?.id === id ? peer.value.side : null
    if (side === null) return null
    if (!moving.value) return 'none'
    return `translateX(${(side - position.value) * 100}%)`
  }

  return { onWheel, place, moving }
}
