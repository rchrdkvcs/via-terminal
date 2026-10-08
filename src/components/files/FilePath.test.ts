import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import FilePath from './FilePath.vue'
const views: ReturnType<typeof mount>[] = []
function render(directory = '/srv/releases/current', connected = true) {
  const view = mount(FilePath, { props: { directory, connected }, attachTo: document.body })
  views.push(view)
  return view
}
afterEach(() => views.splice(0).forEach((view) => view.unmount()))
describe('FilePath', () => {
  it('selects the full path for editing and returns focus after navigation', async () => {
    const view = render()
    await view.get('button').trigger('click')
    const input = view.get<HTMLInputElement>('input')
    expect(document.activeElement).toBe(input.element)
    expect(input.element.selectionEnd).toBe('/srv/releases/current'.length)
    await input.setValue('/srv/folder with spaces ')
    await view.get('form').trigger('submit')
    expect(view.emitted('navigate')).toEqual([['/srv/folder with spaces ']])
    expect(document.activeElement).toBe(view.get('button').element)
  })
  it('cancels with Escape and exposes the original path without navigating', async () => {
    const view = render()
    await view.get('button').trigger('click')
    await view.get('input').setValue('/wrong')
    await view.get('input').trigger('keydown', { key: 'Escape' })
    expect(view.emitted('navigate')).toBeUndefined()
    expect(view.get('button').attributes('title')).toBe('/srv/releases/current')
    expect(document.activeElement).toBe(view.get('button').element)
  })
  it('shows root and relative paths and stops editing when the session disconnects', async () => {
    const view = render('/')
    expect(view.get('button').text()).toBe('/')
    await view.setProps({ directory: '.' })
    expect(view.get('button').text()).toBe('.')
    await view.get('button').trigger('click')
    await view.setProps({ connected: false })
    expect(view.find('input').exists()).toBe(false)
    expect(view.get('button').attributes('disabled')).toBeDefined()
  })
})
