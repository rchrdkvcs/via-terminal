import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from './app'

describe('workspace navigation', () => {
  beforeEach(() => setActivePinia(createPinia()))

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
  beforeEach(() => setActivePinia(createPinia()))

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
})
