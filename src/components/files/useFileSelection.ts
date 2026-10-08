import { watch, type ComputedRef } from 'vue'
import type { RemoteEntry } from '@/ipc/files'

/** Selection follows visible row order; the anchor stays fixed while extending a range. */
export function useFileSelection(
  entries: ComputedRef<RemoteEntry[]>,
  selected: () => string[],
  change: (paths: string[]) => void,
) {
  let anchor: string | undefined
  watch(entries, () => (anchor = undefined))

  function select(entry: RemoteEntry, event: MouseEvent | KeyboardEvent) {
    const paths = entries.value.map((item) => item.path)
    const additive = event.metaKey || event.ctrlKey
    const start = paths.indexOf(anchor ?? selected()[0])
    if (event.shiftKey && start !== -1) {
      anchor = paths[start]
      const end = paths.indexOf(entry.path)
      const range = paths.slice(Math.min(start, end), Math.max(start, end) + 1)
      change(additive ? [...new Set([...selected(), ...range])] : range)
    } else {
      anchor = entry.path
      change(
        additive
          ? selected().includes(entry.path)
            ? selected().filter((path) => path !== entry.path)
            : [...selected(), entry.path]
          : [entry.path],
      )
    }
    const row = (event.currentTarget as HTMLElement).closest('[role="row"]')
    row?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }

  function keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      event.stopPropagation()
      change(entries.value.map((entry) => entry.path))
    } else if (event.key === 'Escape' && selected().length) {
      event.stopPropagation()
      anchor = undefined
      change([])
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const root = event.currentTarget as HTMLElement
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('[role="cell"] button')]
      const current = buttons.indexOf(event.target as HTMLButtonElement)
      if (current === -1) return
      event.preventDefault()
      event.stopPropagation()
      const next = Math.max(
        0,
        Math.min(buttons.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)),
      )
      if (!anchor) anchor = entries.value[current].path
      select(entries.value[next], event)
      buttons[next].focus()
    }
  }
  return { select, keydown }
}
