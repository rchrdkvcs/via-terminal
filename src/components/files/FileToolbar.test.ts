import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import FileToolbar from './FileToolbar.vue'
const views: ReturnType<typeof mount>[] = []
function render(props: Partial<InstanceType<typeof FileToolbar>['$props']> = {}) {
  const view = mount(FileToolbar, {
    props: { count: 0, enabled: true, hidden: true, docked: true, ...props },
    attachTo: document.body,
  })
  views.push(view)
  return view
}
async function open(view: ReturnType<typeof render>, name = 'Autres actions') {
  await view.get(`button[aria-label="${name}"]`).trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return new DOMWrapper(document.body).get('[role="menu"]')
}
afterEach(() => views.splice(0).forEach((view) => view.unmount()))
describe('FileToolbar', () => {
  it.each([0, 1, 2])('gates selection actions for %i selected entries', async (count) => {
    const menu = await open(render({ count }))
    const actions = menu.findAll('[role="menuitem"]').slice(0, 4)
    expect(actions.map((item) => item.attributes('data-disabled') !== undefined)).toEqual([
      count === 0,
      count !== 1,
      count !== 1,
      count === 0,
    ])
  })
  it('keeps view actions available when disconnected and disables file operations', async () => {
    const view = render({ enabled: false, count: 1 })
    expect(view.get('button[aria-label="Créer ou envoyer"]').attributes('disabled')).toBeDefined()
    const menu = await open(view)
    const actions = menu.findAll('[role="menuitem"]')
    expect(
      actions.slice(0, 4).every((item) => item.attributes('data-disabled') !== undefined),
    ).toBe(true)
    expect(actions.slice(4).every((item) => item.attributes('data-disabled') === undefined)).toBe(
      true,
    )
    const hidden = menu.get('[role="menuitemcheckbox"]')
    expect(hidden.attributes('aria-checked')).toBe('true')
    await hidden.trigger('click')
    expect(view.emitted('hidden')).toEqual([[]])
  })
  it('routes all creation and upload choices to the existing operations', async () => {
    const view = render()
    for (let index = 0; index < 4; index++) {
      const menu = await open(view, 'Créer ou envoyer')
      await menu.findAll('[role="menuitem"]')[index].trigger('click')
      await flushPromises()
    }
    expect(view.emitted('create')).toEqual([[false], [true]])
    expect(view.emitted('upload')).toEqual([[false], [true]])
  })
  it('hides dock-only actions in a full explorer tab and forwards a download', async () => {
    const view = render({ docked: false, count: 2 })
    const menu = await open(view)
    expect(menu.text()).not.toContain('Ouvrir dans un onglet')
    expect(menu.text()).not.toContain('Masquer l’explorateur')
    await menu.findAll('[role="menuitem"]')[0].trigger('click')
    expect(view.emitted('download')).toEqual([[]])
  })
})
