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
  it('selects every visible entry from the header and clears it with Escape', async () => {
    const view = render({ selected: ['/srv/app.log'] })
    const all = view.get<HTMLInputElement>('[role="columnheader"] input[type="checkbox"]')
    expect(all.element.indeterminate).toBe(true)
    await all.setValue(true)
    expect(view.emitted('selectAll')?.[0]).toEqual([['/srv/app.log', '/srv/releases']])
    await view.get('[role="cell"] button').trigger('keydown', { key: 'Escape' })
    expect(view.emitted('selectAll')?.[1]).toEqual([[]])
    view.unmount()
  })

  it('opens with Enter, toggles selection on click and names entry kinds', async () => {
    const view = render()
    const [log, releases] = view.findAll('[role="cell"] button')
    expect(releases.text()).toContain('dossier')
    await log.trigger('click')
    await releases.trigger('keydown', { key: 'Enter' })
    expect(view.emitted('select')).toEqual([['/srv/app.log', true]])
    expect(view.emitted('open')?.[0]?.[0]).toMatchObject({ path: '/srv/releases' })
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
