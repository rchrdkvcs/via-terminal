import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { usePreferredReducedMotion, useResizeObserver } from '@vueuse/core'
import { api, isNative } from '@/ipc/client'
import { on } from '@/ipc/events'
import type { Id } from '@/ipc/types'
import { useSpaces } from '@/stores/spaces'
import { createSwipeTracker, spring } from './swipeTracker'
import { createWheelPan } from './wheelPan'

const GAIN = 1.5

const SWITCH_OMEGA = 37

const RETURN_OMEGA = Math.sqrt(250)

const REST = 0.0005
const REST_SPEED = 0.01

const phased = isNative() && /Mac/.test(navigator.userAgent)

export function useSpaceTrack(sidebar: Ref<HTMLElement | undefined>) {
  const spaces = useSpaces()
  const motion = usePreferredReducedMotion()
  const reduced = computed(() => motion.value === 'reduce')
  const position = ref(0)

  const peer = ref<{ id: Id; side: 1 | -1 } | null>(null)
  const moving = ref(false)
  let frame = 0

  let base = 0

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
      stop()
      base = position.value
      moving.value = true
    },
    move: (amount) => pull(base + GAIN * amount),
    cross: () => {
      if (phased) api.swipeHaptic().catch(() => {})
    },
    commit: (direction, velocity) => {
      spaces.cycle(direction)
      if (moving.value) settle(GAIN * velocity, SWITCH_OMEGA)
    },
    cancel: (velocity) => settle(GAIN * velocity, RETURN_OMEGA),
  })

  const onWheel = createWheelPan({
    phased,
    pan: feed,
    step: (direction) => spaces.cycle(direction),
  })

  watch(
    () => spaces.activeId,
    (_, old) => {
      if (reduced.value || !old || !spaces.byId(old)) return rest()

      const direction = spaces.switchDirection
      moving.value = true
      position.value -= direction
      peer.value = { id: old, side: -direction as 1 | -1 }
      settle(0, SWITCH_OMEGA)
    },
    { flush: 'sync' },
  )

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

  function place(id: Id): string | null {
    const side = id === spaces.active.id ? 0 : peer.value?.id === id ? peer.value.side : null
    if (side === null) return null
    if (!moving.value) return 'none'
    return `translateX(${(side - position.value) * 100}%)`
  }

  return { onWheel, place, moving }
}
