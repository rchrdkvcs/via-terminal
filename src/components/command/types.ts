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

  tabId?: string
  run?: () => void
}
