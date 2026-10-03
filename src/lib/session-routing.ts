/**
 * Which tab a session id belongs to, tolerant of event order.
 *
 * Rust may emit output and state for a session before `open` has returned its
 * id to the interface. Such events wait until the id is bound; events of a
 * session that already ended are dropped instead of waiting forever. An event
 * is delivered only while its session is still bound to the tab, so an early
 * event that ends the session drops the ones queued after it.
 */
export class SessionRouting<Id = string> {
  private tabs = new Map<Id, Id>()
  private early = new Map<Id, Array<(tabId: Id) => void>>()
  private finished = new Set<Id>()

  bind(sessionId: Id, tabId: Id) {
    this.tabs.set(sessionId, tabId)
    const early = this.early.get(sessionId) ?? []
    this.early.delete(sessionId)
    for (const deliver of early) if (this.tabs.get(sessionId) === tabId) deliver(tabId)
  }

  /** The session ended or was closed: later events for it are ignored. */
  finish(sessionId: Id) {
    this.tabs.delete(sessionId)
    this.early.delete(sessionId)
    this.finished.add(sessionId)
  }

  tabOf(sessionId: Id): Id | undefined {
    return this.tabs.get(sessionId)
  }

  route(sessionId: Id, deliver: (tabId: Id) => void) {
    const tabId = this.tabs.get(sessionId)
    if (tabId !== undefined) deliver(tabId)
    else if (!this.finished.has(sessionId)) {
      this.early.set(sessionId, [...(this.early.get(sessionId) ?? []), deliver])
    }
  }
}
