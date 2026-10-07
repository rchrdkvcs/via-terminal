import type { ComputedRef } from 'vue'
import type { Id, Tab } from '@/ipc/types'
import type { useSessions } from './sessions'
import type { useSpaces } from './spaces'

export interface WorkbenchParts {
  spaces: ReturnType<typeof useSpaces>
  sessions: ReturnType<typeof useSessions>

  focused: Record<Id, Id | undefined>
  activeTab: ComputedRef<Tab | undefined>

  activate: (tabId: Id, options?: { wake?: boolean }) => void

  focusTerminal: (tabId: Id) => void
}

export interface Closed {
  undo?: () => boolean
}
