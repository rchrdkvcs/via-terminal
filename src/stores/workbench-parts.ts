import type { ComputedRef } from 'vue'
import type { Id, Tab } from '@/ipc/types'
import type { useSessions } from './sessions'
import type { useSpaces } from './spaces'

/** What the workbench store shares with the modules it is built from. */
export interface WorkbenchParts {
  spaces: ReturnType<typeof useSpaces>
  sessions: ReturnType<typeof useSessions>
  /** Focused tab of each space. */
  focused: Record<Id, Id | undefined>
  activeTab: ComputedRef<Tab | undefined>
  /** Focus a tab, waking it unless `wake` is false. */
  activate: (tabId: Id, options?: { wake?: boolean }) => void
  /** Give the keyboard to a tab's terminal once it is shown. */
  focusTerminal: (tabId: Id) => void
}

/** A tab left the organization; an undoable removal can put it back once. */
export interface Closed {
  undo?: () => boolean
}
