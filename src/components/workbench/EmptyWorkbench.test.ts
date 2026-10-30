import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUi } from '@/stores/ui'
import EmptyWorkbench from './EmptyWorkbench.vue'

const { state, workbench } = vi.hoisted(() => ({
  state: { hosts: [] as { id: string; label: string; address: string }[] },
  workbench: { open: vi.fn(), show: vi.fn() },
}))

const shells = [
  { path: '/bin/zsh', name: 'zsh', args: [] },
  { path: '/bin/bash', name: 'bash', args: [] },
]

vi.mock('@/stores/workbench', () => ({ useWorkbench: () => workbench }))
vi.mock('@/stores/settings', () => ({
  useSettings: () => ({
    shells,
    shellFor: () => shells[0],
    platform: 'macos',
    settings: { keybindings: {} },
  }),
}))
vi.mock('@/stores/spaces', () => ({
  useSpaces: () => ({
    spaces: [],
    active: { name: 'Perso', icon: 'terminal', defaultShell: null, pinned: [], temporary: [] },
  }),
}))
vi.mock('@/stores/vault', () => ({
  useVault: () => ({
    get recentHosts() {
      return state.hosts
    },
    host: (id: string) => state.hosts.find((host) => host.id === id),
    describe: (id: string) => `root@${state.hosts.find((host) => host.id === id)?.address}`,
  }),
}))
vi.mock('@/domain/space', () => ({ rows: () => [], tabs: () => [] }))

function render() {
  return mount(EmptyWorkbench, { attachTo: document.body })
}

const button = (page: ReturnType<typeof render>, text: string) =>
  page.findAll('button').find((candidate) => candidate.text().includes(text))!

describe('EmptyWorkbench', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    state.hosts = []
    workbench.open.mockClear()
    workbench.show.mockClear()
  })

  it('opens the default shell or another detected shell', async () => {
    const page = render()
    await button(page, 'zsh').trigger('click')
    expect(workbench.open).toHaveBeenLastCalledWith({ kind: 'local', shell: null, cwd: null })

    await button(page, 'bash').trigger('click')
    expect(workbench.open).toHaveBeenLastCalledWith({
      kind: 'local',
      shell: '/bin/bash',
      cwd: null,
    })
    page.unmount()
  })

  it('lists recent hosts and draws one node per host', async () => {
    state.hosts = [
      { id: 'a', label: 'prod', address: 'prod.example.com' },
      { id: 'b', label: 'staging', address: 'staging.example.com' },
      { id: 'c', label: 'nas', address: 'nas.local' },
      { id: 'd', label: 'vps', address: 'vps.example.net' },
    ]
    const page = render()
    expect(page.text()).toContain('Récents')
    expect(page.findAll('.host:not(.ghost)')).toHaveLength(4)

    await button(page, 'staging').trigger('click')
    expect(workbench.show).toHaveBeenCalledWith({ kind: 'host', hostId: 'b' })
    page.unmount()
  })

  it('fills the scene with placeholders and hides recents when there are none', () => {
    const page = render()
    expect(page.text()).not.toContain('Récents')
    expect(page.findAll('.host.ghost')).toHaveLength(3)
    page.unmount()
  })

  it('opens the command bar, the vault and the settings', async () => {
    const ui = useUi()
    const page = render()
    await button(page, 'Rechercher un hôte').trigger('click')
    expect(ui.command).toEqual({ kind: 'new' })

    await button(page, 'Actions').trigger('click')
    expect(ui.command).toEqual({ kind: 'actions' })

    await button(page, 'Coffre').trigger('click')
    expect(ui.route).toBe('vault')

    await button(page, 'Réglages').trigger('click')
    expect(ui.route).toBe('settings')
    page.unmount()
  })
})
