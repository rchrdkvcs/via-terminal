import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteEntry } from '@/ipc/files'
import FilePath from './FilePath.vue'
const views: ReturnType<typeof mount>[] = []
function render(
  directory = '/srv/releases/current',
  connected = true,
  props: Partial<InstanceType<typeof FilePath>['$props']> = {},
) {
  const view = mount(FilePath, {
    props: { directory, connected, ...props },
    attachTo: document.body,
  })
  views.push(view)
  return view
}
const folder = (path: string, kind: RemoteEntry['kind'] = 'directory') =>
  ({ name: path.split('/').pop(), path, kind, targetKind: null }) as RemoteEntry
async function openMenu(trigger: Pick<DOMWrapper<Element>, 'trigger'>) {
  await trigger.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return new DOMWrapper(document.body).get('[role="menu"]')
}
const pencil = (view: ReturnType<typeof render>) =>
  view.get('[aria-label="Modifier le chemin distant"]')
const crumb = (view: ReturnType<typeof render>, label: string) =>
  view.findAll('nav button').find((button) => button.text() === label)!
afterEach(() => views.splice(0).forEach((view) => view.unmount()))
describe('FilePath', () => {
  it('lists the folders of a crumb with the path’s next one selected', async () => {
    const browse = vi.fn(async () => [
      folder('/srv/data'),
      folder('/srv/notes', 'file'),
      folder('/srv/releases'),
    ])
    const view = render('/srv/releases/current', true, { browse })
    expect(view.findAll('nav button').map((button) => button.text())).toEqual([
      '/',
      'srv',
      'releases',
      'current',
    ])
    expect(crumb(view, 'current').attributes('aria-current')).toBe('location')
    const menu = await openMenu(crumb(view, 'srv'))
    expect(browse).toHaveBeenCalledWith('/srv')
    const items = menu.findAll('[role="menuitem"]')
    expect(items.map((item) => item.text())).toEqual(['Ouvrir srv', 'data', 'releases'])
    expect(items[2].attributes('aria-current')).toBe('location')
    expect(items[1].attributes('aria-current')).toBeUndefined()
    await items[1].trigger('click')
    expect(view.emitted('navigate')).toEqual([['/srv/data']])
    await (await openMenu(crumb(view, 'srv'))).findAll('[role="menuitem"]')[0].trigger('click')
    expect(view.emitted('navigate')).toEqual([['/srv/data'], ['/srv']])
  })
  it('lists the current folder from its own listing, without dot folders when hidden', async () => {
    const browse = vi.fn()
    const view = render('/etc/', true, {
      browse,
      hidden: false,
      entries: [folder('/etc/nginx'), folder('/etc/.git'), folder('/etc/hosts', 'file')],
    })
    const items = (await openMenu(crumb(view, 'etc'))).findAll('[role="menuitem"]')
    expect(items.map((item) => item.text())).toEqual(['nginx'])
    expect(browse).not.toHaveBeenCalled()
  })
  it('reports a failed listing inside the menu', async () => {
    const view = render('/etc', true, {
      browse: async () => {
        throw { code: 'sftp', message: 'Permission refusée' }
      },
    })
    const menu = await openMenu(crumb(view, '/'))
    expect(menu.get('[role="alert"]').text()).toContain('Permission refusée')
  })
  it('collapses a deep path into a menu of the hidden folders', async () => {
    const view = render('/a/b/c/d/e')
    expect(view.findAll('nav button').map((button) => button.text())).toEqual(['/', '…', 'd', 'e'])
    const menu = await openMenu(view.get('[aria-label="Dossiers masqués du chemin"]'))
    const items = menu.findAll('[role="menuitem"]')
    expect(items.map((item) => item.text())).toEqual(['/a', '/a/b', '/a/b/c'])
    await items[1].trigger('click')
    expect(view.emitted('navigate')).toEqual([['/a/b']])
    await view.get('[aria-label="Modifier le chemin distant"]').trigger('click')
    expect(view.get<HTMLInputElement>('input').element.value).toBe('/a/b/c/d/e')
  })
  it('selects the full path for editing and returns focus after navigation', async () => {
    const view = render()
    await pencil(view).trigger('click')
    const input = view.get<HTMLInputElement>('input')
    expect(document.activeElement).toBe(input.element)
    expect(input.element.selectionEnd).toBe('/srv/releases/current'.length)
    await input.setValue('/srv/folder with spaces ')
    await view.get('form').trigger('submit')
    expect(view.emitted('navigate')).toEqual([['/srv/folder with spaces ']])
    expect(document.activeElement).toBe(pencil(view).element)
  })
  it('offers the listed subdirectories as completions', async () => {
    const view = mount(FilePath, {
      props: {
        directory: '/srv',
        connected: true,
        entries: [folder('/srv/a'), folder('/srv/f', 'file'), folder('/srv/b')],
      },
      attachTo: document.body,
    })
    views.push(view)
    await pencil(view).trigger('click')
    const list = view.get('datalist')
    expect(view.get('input').attributes('list')).toBe(list.attributes('id'))
    expect(list.findAll('option').map((option) => option.attributes('value'))).toEqual([
      '/srv/a',
      '/srv/b',
    ])
  })
  it('cancels with Escape and exposes the original path without navigating', async () => {
    const view = render()
    await pencil(view).trigger('click')
    await view.get('input').setValue('/wrong')
    await view.get('input').trigger('keydown', { key: 'Escape' })
    expect(view.emitted('navigate')).toBeUndefined()
    expect(view.find('[title="/srv/releases/current"]').exists()).toBe(true)
    expect(document.activeElement).toBe(pencil(view).element)
  })
  it('shows root and relative paths and stops editing when the session disconnects', async () => {
    const view = render('/')
    expect(view.get('nav').text()).toBe('/')
    await view.setProps({ directory: '.' })
    expect(view.get('nav').text()).toBe('.')
    await pencil(view).trigger('click')
    await view.setProps({ connected: false })
    expect(view.find('input').exists()).toBe(false)
    expect(pencil(view).attributes('disabled')).toBeDefined()
  })
})
