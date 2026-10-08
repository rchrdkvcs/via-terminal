import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { RemoteEntry } from '@/ipc/files'
import FileList from './FileList.vue'

const entry = (name: string, kind: RemoteEntry['kind'] = 'file'): RemoteEntry => ({
  name,
  path: `/srv/${name}`,
  kind,
  targetKind: null,
  size: 2048,
  modified: null,
  permissions: 0o100644,
})
const entries = [entry('.env'), entry('app.log'), entry('releases', 'directory')]

function render(props: Partial<InstanceType<typeof FileList>['$props']> = {}) {
  return mount(FileList, {
    props: {
      entries,
      selected: [],
      busy: false,
      hidden: false,
      connected: true,
      failed: false,
      ...props,
    },
    attachTo: document.body,
  })
}

describe('FileList', () => {
  it('selects only the clicked entry and removes selection checkboxes', async () => {
    const view = render({ selected: ['/srv/app.log'] })
    expect(view.find('input[type="checkbox"]').exists()).toBe(false)
    await view.findAll('[role="cell"] button')[1].trigger('click')
    expect(view.emitted('selectAll')).toEqual([[['/srv/releases']]])
    await view.setProps({ selected: ['/srv/releases'] })
    await view.findAll('[role="cell"] button')[1].trigger('click')
    expect(view.emitted('selectAll')?.[1]).toEqual([['/srv/releases']])
    view.unmount()
  })

  it.each(['metaKey', 'ctrlKey'])('adds and removes entries with %s + click', async (modifier) => {
    const view = render({ selected: ['/srv/app.log'] })
    const releases = view.findAll('[role="cell"] button')[1]
    await releases.trigger('click', { [modifier]: true })
    expect(view.emitted('selectAll')?.[0]).toEqual([['/srv/app.log', '/srv/releases']])
    await view.setProps({ selected: ['/srv/app.log', '/srv/releases'] })
    await releases.trigger('click', { [modifier]: true })
    expect(view.emitted('selectAll')?.[1]).toEqual([['/srv/app.log']])
    view.unmount()
  })

  it('extends and shrinks a visible range from the original anchor', async () => {
    const view = render({ entries: [...entries, entry('z.txt')] })
    const buttons = view.findAll('[role="cell"] button')
    await buttons[0].trigger('click')
    await view.setProps({ selected: ['/srv/app.log'] })
    await buttons[2].trigger('click', { shiftKey: true })
    expect(view.emitted('selectAll')?.[1]).toEqual([
      ['/srv/app.log', '/srv/releases', '/srv/z.txt'],
    ])
    await view.setProps({ selected: ['/srv/app.log', '/srv/releases', '/srv/z.txt'] })
    await buttons[1].trigger('click', { shiftKey: true })
    expect(view.emitted('selectAll')?.[2]).toEqual([['/srv/app.log', '/srv/releases']])
    view.unmount()
  })

  it.each(['metaKey', 'ctrlKey'])(
    'selects visible entries with %s + A and clears with Escape',
    async (modifier) => {
      const view = render({ selected: ['/srv/app.log'] })
      const log = view.get('[role="cell"] button')
      await log.trigger('keydown', { key: 'a', [modifier]: true })
      expect(view.emitted('selectAll')?.[0]).toEqual([['/srv/app.log', '/srv/releases']])
      await log.trigger('keydown', { key: 'Escape' })
      expect(view.emitted('selectAll')?.[1]).toEqual([[]])
      view.unmount()
    },
  )

  it('opens with Enter and double click, and selects with Space and Shift + arrows', async () => {
    const view = render()
    const [log, releases] = view.findAll('[role="cell"] button')
    expect(releases.text()).toContain('dossier')
    await log.trigger('keydown', { key: ' ', code: 'Space' })
    expect(view.emitted('selectAll')?.[0]).toEqual([['/srv/app.log']])
    await view.setProps({ selected: ['/srv/app.log'] })
    await log.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(view.emitted('selectAll')?.[1]).toEqual([['/srv/app.log', '/srv/releases']])
    expect(document.activeElement).toBe(releases.element)
    await releases.trigger('keydown', { key: 'ArrowUp' })
    expect(view.emitted('selectAll')?.[2]).toEqual([['/srv/app.log']])
    await releases.trigger('keydown', { key: 'Enter' })
    await releases.trigger('dblclick')
    expect(view.emitted('open')).toEqual([[entries[2]], [entries[2]]])
    view.unmount()
  })

  it('does not call a disconnected or hidden-only directory empty', () => {
    expect(render({ entries: [], connected: false }).text()).not.toContain('vide')
    expect(render({ entries: [entry('.env')] }).text()).toContain(
      'ne contient que des fichiers cachés',
    )
    expect(render({ entries: [] }).text()).toContain('Ce dossier est vide.')
  })
})
