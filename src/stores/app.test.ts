import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from './app'

describe('workspace navigation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
  })

  it('keeps sessions alive while switching workspaces', async () => {
    const store = useAppStore()
    await store.createTerminal('Diagnostic')
    const sessionId = store.activeSession?.id

    store.switchWorkspace('infrastructure')

    expect(store.sessions.find((session) => session.id === sessionId)?.status).toBe('connected')
    expect(store.activeWorkspace?.name).toBe('Infrastructure')
  })

  it('cycles workspace navigation in both directions', () => {
    const store = useAppStore()
    store.cycleWorkspace(-1)
    expect(store.activeWorkspaceId).toBe('personnel')
    store.cycleWorkspace(1)
    expect(store.activeWorkspaceId).toBe('support')
  })
})

describe('terminal tabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
  })

  it('opens a terminal in the current workspace', async () => {
    const store = useAppStore()
    store.switchWorkspace('infrastructure')
    await store.createTerminal('Ubuntu')
    expect(store.visibleTabs).toHaveLength(1)
    expect(store.activeSession).toMatchObject({ name: 'Ubuntu', workspaceId: 'infrastructure' })
  })

  it('closes only the selected tab', async () => {
    const store = useAppStore()
    await store.createTerminal('Second terminal')
    const firstId = store.tabs[0].id
    await store.closeTab(firstId)
    expect(store.tabs.some((tab) => tab.id === firstId)).toBe(false)
    expect(store.visibleTabs).toHaveLength(1)
  })

  it('splits the active tab without replacing its first session', async () => {
    const store = useAppStore()
    const firstSessionId = store.activeSession?.id
    await store.splitActiveTab('vertical')
    const tab = store.tabs.find((item) => item.id === store.activeTabId)
    expect(tab).toMatchObject({ sessionId: firstSessionId, split: 'vertical' })
    expect(tab?.secondarySessionId).toBeTruthy()
    expect(store.sessions).toHaveLength(2)
  })

  it('opens a resource as an SSH session', async () => {
    const store = useAppStore()
    const resource = store.tree[1].children![0]
    await store.openSidebarNode(resource)
    expect(store.activeSession).toMatchObject({
      kind: 'ssh',
      resourceId: resource.id,
      workspaceId: 'support',
    })
  })

  it('keeps an active tab when close confirmation is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const store = useAppStore()
    const id = store.tabs[0].id
    await store.closeTab(id)
    expect(store.tabs.some((tab) => tab.id === id)).toBe(true)
  })

  it('reports disconnected sessions on their workspace', () => {
    const store = useAppStore()
    store.updateSessionStatus('welcome', 'disconnected', 'Connexion perdue')
    expect(store.workspaces[0].activity).toBe(true)
    expect(store.notices[0]).toMatchObject({ kind: 'error', message: 'Connexion perdue' })
  })
})
