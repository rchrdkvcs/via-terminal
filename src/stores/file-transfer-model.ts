import {
  filesApi,
  type TransferDirection,
  type TransferEvent,
  type TransferPlan,
} from '@/ipc/files'
/** `preparing` exists only here: a drop copied to local staging before its upload starts. */
export type TransferState = TransferEvent['state'] | 'preparing'
export interface Transfer {
  id: string
  sessionId: string
  /** A preparation is always an upload. */
  direction: TransferDirection
  state: TransferState
  path: string
  bytes: number
  total: number
  message: string | null
  skipped: string[]
  /** A failed transfer whose plan is kept for retry after reconnection. */
  retryable: boolean
}
/** Store-private record of a transfer, kept beyond its list item until settled. */
export interface Tracked {
  tabId: string
  sessionId: string
  state: TransferState
  plan?: TransferPlan
  stagingId?: string
}
const ACTIVE: readonly TransferState[] = ['preparing', 'running', 'conflict']
export const isActive = (state: TransferState) => ACTIVE.includes(state)
export const isProgressing = (state: TransferState) => state === 'preparing' || state === 'running'
export const isFinished = (state: TransferState) => !isActive(state)
/** Removes a drop's local staging, best effort. */
export const discard = (stagingId?: string) =>
  stagingId ? filesApi.stageDiscard(stagingId).catch(() => undefined) : undefined
