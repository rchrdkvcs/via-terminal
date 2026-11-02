import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import FilePath from './FilePath.vue'
const views: ReturnType<typeof mount>[] = []
function render(directory = '/srv/releases/current', connected = true) {
  const view = mount(FilePath, { props: { directory, connected }, attachTo: document.body })
  views.push(view)
  return view
}
const pencil = (view: ReturnType<typeof render>) =>
  view.get('[aria-label="Modifier le chemin distant"]')
const crumb = (view: ReturnType<typeof render>, label: string) =>
  view.findAll('nav button').find((button) => button.text() === label)!
afterEach(() => views.splice(0).forEach((view) => view.unmount()))
describe('FilePath', () => {
  it('navigates up the tree from a crumb, not from the current one', async () => {
    const view = render()
    expect(view.findAll('nav button').map((button) => button.text())).toEqual([
      '/',
      'srv',
      'releases',
      'current',
    ])
    await crumb(view, 'srv').trigger('click')
    await crumb(view, 'current').trigger('click')
    expect(view.emitted('navigate')).toEqual([['/srv']])
    expect(crumb(view, 'current').attributes('aria-current')).toBe('location')
  })
  it('collapses a deep path and expands it for editing', async () => {
    const view = render('/a/b/c/d/e')
    expect(view.findAll('nav button').map((button) => button.text())).toEqual(['/', '…', 'd', 'e'])
    await view.get('[aria-label="Afficher le chemin complet"]').trigger('click')
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
      props: { directory: '/srv', connected: true, directories: ['/srv/a', '/srv/b'] },
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
