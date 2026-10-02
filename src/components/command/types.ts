import type { Component } from 'vue'
import type { Target } from '@/ipc/types'

/** One line of the command bar. Either opens a target or runs an action. */
export interface CommandItem {
  id: string
  section: string
  label: string
  detail?: string
  icon: Component
  shortcut?: string
  /** A target is opened according to the bar's mode (new, replace, split). */
  target?: Target
  /** An existing tab to switch to (or to split with). */
  tabId?: string
  run?: () => void
}
