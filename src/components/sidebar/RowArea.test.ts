import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import type { Entry } from '@/ipc/types'
import RowArea from './RowArea.vue'

const { states, active } = vi.hoisted(() => ({
  states: {} as Record<string, string>,
  active: { id: null as string | null },
}))
vi.mock('@/stores/sessions', () => ({
  useSessions: () => ({ runtime: (id: string) => ({ state: states[id] ?? 'asleep' }) }),
}))
vi.mock('@/stores/workbench', () => ({
  useWorkbench: () => ({ activeTab: active.id ? { id: active.id } : undefined }),
}))
vi.mock('@/stores/spaces', () => ({ useSpaces: () => ({}) }))
vi.mock('@/composables/useSidebarActions', () => ({ useSidebarActions: () => ({}) }))
vi.mock('@/composables/useRowDnd', () => ({ useDropZone: () => {}, dragging: null }))
vi.mock('@/composables/useDropGap', () => ({
  endTarget: () => 'end',
  useDropGap: () => ({ lineBefore: () => false, lineAtEnd: () => false }),
}))

const tab = (id: string) => ({ kind: 'tab', id }) as unknown as Entry
const split = (id: string, tabs: string[]) =>
  ({ kind: 'split', id, tabs: tabs.map((tabId) => ({ id: tabId })) }) as unknown as Entry

afterEach(() => {
  for (const id of Object.keys(states)) delete states[id]
  active.id = null
})

function visible(collapsed: boolean) {
  const wrapper = mount(RowArea, {
    props: {
      area: 'pinned',
      folderId: 'folder',
      entries: [
        tab('asleep'),
        tab('live'),
        tab('exited'),
        split('split', ['a', 'b']),
        tab('active'),
      ],
      label: 'Contenu',
      collapsed,
    },
    global: { stubs: { RowItem: { props: ['row'], template: '<div>{{ row.id }}</div>' } } },
  })
  return wrapper
    .findAll('li')
    .filter((li) => li.classes('opacity-100'))
    .map((li) => li.text())
}

it('keeps rows with a session or the active tab visible in a collapsed folder', () => {
  Object.assign(states, { live: 'ready', exited: 'exited', b: 'connecting' })
  active.id = 'active'
  expect(visible(true)).toEqual(['live', 'split', 'active'])
  expect(visible(false)).toEqual(['asleep', 'live', 'exited', 'split', 'active'])
})
