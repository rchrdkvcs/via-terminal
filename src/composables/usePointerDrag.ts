import { readonly, ref } from 'vue'
import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

/**
 * Owns the pointer-capture lifecycle shared by resize handles and the title bar.
 * Starting a new drag always replaces the previous one and scope disposal cannot
 * leave listeners or pointer capture behind.
 */
export function usePointerDrag() {
  const active = ref(false)
  let target: HTMLElement | undefined
  let pointerId: number | undefined
  let onMove: ((event: PointerEvent) => void) | undefined
  let onEnd: (() => void) | undefined

  const stopMove = useEventListener(window, 'pointermove', (event) => onMove?.(event))
  const stopUp = useEventListener(window, 'pointerup', stop)
  const stopCancel = useEventListener(window, 'pointercancel', stop)

  function stop() {
    if (!active.value) return
    active.value = false
    if (target && pointerId !== undefined && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }
    target = undefined
    pointerId = undefined
    onMove = undefined
    const end = onEnd
    onEnd = undefined
    end?.()
  }

  function start(event: PointerEvent, move: (event: PointerEvent) => void, end?: () => void) {
    if (event.button !== 0) return false
    stop()
    target = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
    pointerId = event.pointerId
    target?.setPointerCapture(pointerId)
    onMove = move
    onEnd = end
    active.value = true
    return true
  }

  tryOnScopeDispose(() => {
    stop()
    stopMove()
    stopUp()
    stopCancel()
  })

  return { active: readonly(active), start, stop }
}
