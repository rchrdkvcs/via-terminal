import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { Id } from '@/ipc/types'
import { useSpaces } from '@/stores/spaces'
import { createSpaceSwipe } from './spaceSwipe'

/** How long a released or switched space takes to slide home, in ms. */
const SETTLE = 250

/**
 * The spaces as panels side by side on a horizontal track. Every panel stays
 * mounted, so the row under the pointer is never torn out mid-gesture; only
 * the active space and the one beside it are shown, moved by transforms.
 *
 * `offset` is how far the track is pulled, in px: positive shows the next
 * space coming in from the right. A switch, from a swipe or anywhere else,
 * restarts the offset from where the new space stands and eases it to 0.
 */
export function useSpaceTrack(track: Ref<HTMLElement | undefined>) {
  const spaces = useSpaces()
  const motion = usePreferredReducedMotion()
  const reduced = computed(() => motion.value === 'reduce')
  const offset = ref(0)
  /** The space shown beside the active one, and on which side. */
  const peer = ref<{ id: Id; side: 1 | -1 } | null>(null)
  const phase = ref<'rest' | 'drag' | 'settle'>('rest')
  let settling = 0
  let done: ReturnType<typeof setTimeout> | undefined

  const width = () => track.value?.clientWidth ?? spaces.sidebar.width

  function neighbor(side: 1 | -1): Id | null {
    const list = spaces.spaces
    const index = list.findIndex((space) => space.id === spaces.active.id)
    const next = list[(index + side + list.length) % list.length]
    return next && next.id !== spaces.active.id ? next.id : null
  }

  /** Where a space's panel stands on screen as an offset, mid-slide included. */
  function standing(id: Id): number {
    if (phase.value !== 'settle') return offset.value
    const panel = track.value?.querySelector(`[data-space-panel="${CSS.escape(id)}"]`)
    return panel ? -new DOMMatrix(getComputedStyle(panel).transform).m41 : 0
  }

  /** Hold the panels where they stand, without easing. */
  function hold(at: number) {
    settling++
    clearTimeout(done)
    phase.value = 'drag'
    offset.value = at
  }

  /** Ease from the held position to the active space. */
  async function settle() {
    const run = ++settling
    await nextTick()
    // Lay out the starting position before easing, or the slide starts from the end.
    void track.value?.offsetWidth
    if (run !== settling) return
    phase.value = 'settle'
    offset.value = 0
    done = setTimeout(() => {
      if (run !== settling) return
      phase.value = 'rest'
      peer.value = null
    }, SETTLE + 50)
  }

  const onWheel = createSpaceSwipe({
    width,
    canSwitch: () => spaces.spaces.length > 1,
    resume: () => {
      if (reduced.value) return 0
      const at = standing(spaces.active.id)
      hold(at)
      return at
    },
    drag: (at) => {
      if (reduced.value) return
      hold(at)
      const side = Math.sign(at) as 1 | -1 | 0
      const id = side ? neighbor(side) : null
      if (id && side) peer.value = { id, side }
    },
    release: (direction) => {
      if (direction) spaces.cycle(direction)
      else if (!reduced.value) void settle()
    },
    step: (direction) => spaces.cycle(direction),
  })

  // Every switch slides, whatever started it: a swipe, a click, a shortcut.
  watch(
    () => spaces.activeId,
    (_, old) => {
      if (reduced.value || !old || !spaces.byId(old)) {
        hold(0)
        phase.value = 'rest'
        peer.value = null
        return
      }
      const direction = spaces.switchDirection
      hold(standing(old) - direction * width())
      peer.value = { id: old, side: -direction as 1 | -1 }
      void settle()
    },
  )

  onBeforeUnmount(() => clearTimeout(done))

  /** The transform of a space's panel, or `null` when it is out of sight. */
  function place(id: Id): string | null {
    const side = id === spaces.active.id ? 0 : peer.value?.id === id ? peer.value.side : null
    if (side === null) return null
    if (phase.value === 'rest') return 'none'
    return `translateX(calc(${side * 100}% - ${offset.value}px))`
  }

  return { onWheel, place, phase }
}
