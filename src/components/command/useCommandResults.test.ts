import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { DOMWrapper, mount } from '@vue/test-utils'
import { mocks, row, setup, split } from '@/stores/workbench.fixture'
import type { Host, VaultView } from '@/ipc/types'
import { findTab, isPinned, rowOfTab, tabs } from '@/domain/space'
import { useFiles } from '@/stores/files'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi, type CommandMode } from '@/stores/ui'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'
import { useCommandResults } from './useCommandResults'
import CommandBar from './CommandBar.vue'
import PaneNotice from '@/components/workbench/PaneNotice.vue'
import { parseQuickConnect } from '@/domain/quick-connect'

const closing = vi.hoisted(() => ({ closeTab: vi.fn(), replaceTab: vi.fn() }))
vi.mock('@/composables/useClosing', () => ({ useClosing: () => closing }))

function host(id: string, label: string, extra: Partial<Host> = {}): Host {
  return {
    id,
    label,
    address: `${id}.example`,
    groupId: null,
    port: null,
    credential: { kind: 'inherit', username: null, key: null },
    tags: [],
    notes: '',
    createdAt: 0,
    lastConnectedAt: null,
    ...extra,
  }
}

const view: VaultView = {
  groups: [{ id: 'prod', parentId: null, name: 'Production', position: 0, defaults: {} as never }],
  hosts: [
    host('alpha', 'Alpha', { groupId: 'prod', lastConnectedAt: 10 }),
    host('beta', 'Beta', { tags: ['database'] }),
  ],
  identities: [],
  keys: [],
  knownHosts: [],
  passwords: [],
  passphrases: [],
  secretsAvailable: true,
  effective: {},
  revision: 0,
}

const titled = (id: string, title: string) => ({ ...row(id), title })

function open(mode: CommandMode | null, query = '') {
  const pair = split('pair', ['left', 'right'])
  if (pair.kind === 'split') pair.tabs[0].title = 'db logs'
  const { spaces, workbench } = setup(
    [titled('pinned', 'web logs')],
    [titled('tab', 'api logs'), pair],
  )
  useSettings().shells = [{ path: '/bin/zsh', name: 'zsh', args: [] }]
  useVault().hydrate(view)
  workbench.activate('tab', { wake: false })
  const ui = useUi()
  ui.route = 'vault'
  ui.command = mode
  const text = ref(query)
  return { spaces, workbench, ui, query: text, ...useCommandResults(text) }
}

const ids = (items: { id: string }[]) => items.map((item) => item.id)
const item = <T extends { id: string }>(items: T[], id: string) =>
  items.find((found) => found.id === id)!

describe('command bar, new tab', () => {
  it('offers shells and recent hosts before anything is typed, and opens the choice', async () => {
    const bar = open(null)
    expect(bar.mode.value).toEqual({ kind: 'new' })
    expect(ids(bar.items.value)).toEqual(['shell:/bin/zsh', 'host:alpha', 'host:beta'])

    await bar.choose(item(bar.items.value, 'host:beta'))
    expect(bar.ui.command).toBeNull()
    expect(bar.ui.route).toBe('workbench')
    expect(bar.workbench.activeTab?.target).toEqual({ kind: 'host', hostId: 'beta' })
    expect(mocks.start).toHaveBeenCalledOnce()
  })

  it('searches the vault by name, group and tag', () => {
    const bar = open({ kind: 'new' }, 'production')
    expect(ids(bar.items.value).filter((id) => id.startsWith('host:'))).toEqual(['host:alpha'])
    bar.query.value = 'database'
    expect(ids(bar.items.value).filter((id) => id.startsWith('host:'))).toEqual(['host:beta'])
    expect(item(bar.items.value, 'host:beta').section).toBe('Hôtes')
  })

  it('connects quickly to a typed address', async () => {
    const bar = open({ kind: 'new' }, 'admin@10.0.0.5:2222')
    const quick = bar.items.value[0]
    expect(quick.label).toBe('Se connecter à admin@10.0.0.5:2222')
    await bar.choose(quick)
    expect(bar.workbench.activeTab?.target).toEqual({
      kind: 'quick',
      address: '10.0.0.5',
      port: 2222,
      username: 'admin',
    })
  })

  it('goes to an open tab instead of opening another one', async () => {
    const bar = open({ kind: 'new' }, 'web logs')
    bar.workbench.activate('tab', { wake: false })
    const before = tabs(bar.spaces.active).length
    await bar.choose(item(bar.items.value, 'tab:pinned'))
    expect(bar.workbench.activeTab?.id).toBe('pinned')
    expect(tabs(bar.spaces.active)).toHaveLength(before)
  })
})

describe('command bar, replace and split', () => {
  it('reopens a failed quick connection for editing and retries in the same tab', async () => {
    const bar = open({ kind: 'new' })
    bar.workbench.replace('tab', {
      kind: 'quick',
      address: '10.0.0.5',
      username: 'admin',
      port: 2222,
    })
    mocks.failed.add('tab')
    bar.ui.closeCommand()
    const view = mount(CommandBar, { attachTo: document.body })
    const notice = mount(PaneNotice, { props: { tab: bar.workbench.activeTab!, mode: 'failed' } })
    try {
      // Reopening normally restores the failed address.
      bar.ui.openCommand()
      await view.vm.$nextTick()
      const body = new DOMWrapper(document.body)
      expect(body.get<HTMLInputElement>('input[role="combobox"]').element.value).toBe(
        'admin@10.0.0.5:2222',
      )
      bar.ui.closeCommand()
      await view.vm.$nextTick()

      await notice
        .findAll('button')
        .find((button) => button.text() === 'Modifier la connexion')!
        .trigger('click')
      expect(bar.ui.command).toEqual({ kind: 'replace', tabId: 'tab' })
      const input = body.get<HTMLInputElement>('input[role="combobox"]')
      expect(input.element.value).toBe('admin@10.0.0.5:2222')
      await input.setValue('deploy@10.0.0.6:2200')
      await input.trigger('keydown', { key: 'Enter' })
      expect(closing.replaceTab).toHaveBeenCalledWith('tab', {
        kind: 'quick',
        address: '10.0.0.6',
        username: 'deploy',
        port: 2200,
      })
      expect(bar.ui.command).toBeNull()
    } finally {
      view.unmount()
      notice.unmount()
    }
  })

  it.each([
    { address: 'server', username: null, port: 22 },
    { address: '2001:db8::1', username: 'admin', port: 2222 },
  ])('restores a parseable quick connection with all fields: %j', (target) => {
    const bar = open({ kind: 'replace', tabId: 'tab' })
    bar.workbench.replace('tab', { kind: 'quick', ...target })
    mocks.failed.add('tab')
    expect(parseQuickConnect(bar.initialQuery())).toEqual(target)
  })

  it('keeps other command contexts and successful connections empty', () => {
    const bar = open({ kind: 'new' })
    bar.workbench.replace('tab', {
      kind: 'quick',
      address: 'example.test',
      username: 'admin',
      port: null,
    })
    expect(bar.initialQuery()).toBe('')
    mocks.failed.add('tab')
    for (const mode of [{ kind: 'actions' }, { kind: 'split', tabId: 'tab' }] as CommandMode[]) {
      bar.ui.openCommand(mode)
      expect(bar.initialQuery()).toBe('')
    }
    bar.workbench.replace('tab', { kind: 'host', hostId: 'alpha' })
    bar.ui.openCommand()
    expect(bar.initialQuery()).toBe('')
  })

  it('replaces through the closing module and never lists open tabs', async () => {
    const bar = open({ kind: 'replace', tabId: 'tab' }, 'beta')
    expect(ids(bar.items.value)).toEqual(['host:beta'])
    await bar.choose(bar.items.value[0])
    expect(closing.replaceTab).toHaveBeenCalledWith('tab', { kind: 'host', hostId: 'beta' })
    expect(findTab(bar.spaces.active, 'tab')?.target.kind).toBe('local')
  })

  it('splits only with tabs that are alone in another row', async () => {
    const bar = open({ kind: 'split', tabId: 'tab' }, 'logs')
    const offered = ids(bar.items.value).filter((id) => id.startsWith('tab:'))
    expect(offered).toEqual(['tab:pinned'])

    await bar.choose(item(bar.items.value, 'tab:pinned'))
    expect(rowOfTab(bar.spaces.active, 'pinned')).toBe(rowOfTab(bar.spaces.active, 'tab'))
  })

  it('opens a new target beside the anchor tab', async () => {
    const bar = open({ kind: 'split', tabId: 'tab' })
    await bar.choose(item(bar.items.value, 'host:alpha'))
    const opened = bar.workbench.activeTab!
    expect(opened.target).toEqual({ kind: 'host', hostId: 'alpha' })
    expect(rowOfTab(bar.spaces.active, opened.id)).toBe(rowOfTab(bar.spaces.active, 'tab'))
  })
})

describe('command bar, actions', () => {
  it('lists actions on the active tab and runs them', async () => {
    const bar = open({ kind: 'actions' })
    expect(ids(bar.items.value).slice(0, 4)).toEqual([
      'tab:pin',
      'tab:split',
      'tab:rename',
      'tab:close',
    ])
    expect(ids(bar.items.value)).not.toContain('files')

    await bar.choose(item(bar.items.value, 'tab:pin'))
    expect(isPinned(bar.spaces.active, 'tab')).toBe(true)
    expect(bar.ui.command).toBeNull()
    expect(bar.ui.route).toBe('vault')

    bar.ui.command = { kind: 'actions' }
    await bar.choose(item(bar.items.value, 'tab:close'))
    expect(closing.closeTab).toHaveBeenCalledWith('tab')

    bar.ui.command = { kind: 'actions' }
    await bar.choose(item(bar.items.value, 'tab:split'))
    expect(bar.ui.command).toEqual({ kind: 'split', tabId: 'tab' })
  })

  it('finds actions by name and switches spaces', async () => {
    const bar = open({ kind: 'actions' }, 'aller two')
    expect(bar.items.value[0].id).toBe('space:two')
    await bar.choose(bar.items.value[0])
    expect(useSpaces().active.id).toBe('two')
  })

  it('offers the remote explorer for a remote terminal', async () => {
    const bar = open({ kind: 'actions' })
    useWorkbench().replace('tab', { kind: 'host', hostId: 'alpha' })
    await bar.choose(item(bar.items.value, 'files'))
    expect(bar.ui.route).toBe('workbench')
    expect(useFiles().panels.tab?.visible).toBe(true)
  })

  it('suggests a few actions while searching for a new tab', () => {
    const bar = open({ kind: 'new' }, 'nouvel')
    const actions = bar.items.value.filter((found) => found.section === 'Actions')
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.length).toBeLessThanOrEqual(4)
  })
})
