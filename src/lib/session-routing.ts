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
