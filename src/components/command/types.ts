import type { Component } from 'vue'
import type { Target } from '@/ipc/types'

export interface CommandItem {
  id: string
  section: string
  label: string
  detail?: string
  icon: Component
  shortcut?: string

  target?: Target
  /** Opening it goes to a tab already showing `target` in the space, if any. */
  reuse?: boolean

  tabId?: string
  run?: () => void
}
