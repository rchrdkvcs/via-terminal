import type { TransferPlan } from '@/ipc/files'
import { discard, type Tracked, type Transfer, type TransferState } from './file-transfer-model'
import type { Connection, FileState } from './files'
/** A drop being staged. Every step must check `active()`; the store cleans up the rest. */
export interface Preparation {
  readonly id: string
  active(): boolean
  stage(stagingId: string): boolean
  progress(bytes: number): void
  start(sources: string[]): Promise<void>
  fail(message: string): void
}
/** The transfer store's bookkeeping that a preparation hands over to its upload. */
interface Ledger {
  panels: Record<string, FileState>
  connection(tabId: string): Connection | null
  tracked: Map<string, Tracked>
  show(tabId: string, id: string, patch: Partial<Transfer>): void
  end(id: string, state: TransferState, message?: string | null): void
  startTransfer(
    tabId: string,
    plan: Omit<TransferPlan, 'id' | 'owner'>,
    options: { id?: string; stagingId?: string },
  ): Promise<void>
}
export function preparation({ panels, connection, tracked, show, end, startTransfer }: Ledger) {
  return function prepareTransfer(
    tabId: string,
    destination: string,
    total: number,
  ): Preparation | null {
    const link = connection(tabId)
    if (!panels[tabId] || !link) return null
    const id = crypto.randomUUID()
    tracked.set(id, { tabId, connection: link, state: 'preparing' })
    show(tabId, id, { sessionId: link.sessionId, state: 'preparing', path: destination, total })
    const active = () => tracked.get(id)?.state === 'preparing' && link.current()
    const preparation: Preparation = {
      id,
      active,
      stage(stagingId) {
        if (active()) tracked.get(id)!.stagingId = stagingId
        else void discard(stagingId)
        return active()
      },
      progress(bytes) {
        if (active()) show(tabId, id, { bytes })
      },
      async start(sources) {
        if (!active()) return end(id, 'cancelled')
        const plan = { direction: 'upload' as const, sources, destination }
        await startTransfer(tabId, plan, { id, stagingId: tracked.get(id)!.stagingId })
      },
      fail: (message) => end(id, 'failed', message),
    }
    return preparation
  }
}
