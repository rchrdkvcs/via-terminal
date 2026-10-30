import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import FileToolbar from './FileToolbar.vue'
const views: ReturnType<typeof mount>[] = []
function render(props: Partial<InstanceType<typeof FileToolbar>['$props']> = {}) {
  const view = mount(FileToolbar, {
    props: { enabled: true, hidden: true, docked: true, ...props },
    attachTo: document.body,
  })
  views.push(view)
  return view
}
afterEach(() => views.splice(0).forEach((view) => view.unmount()))
describe('FileToolbar', () => {
  it('has no overflow menu', () => {
    expect(render().find('button[aria-label="Autres actions"]').exists()).toBe(false)
  })
  it('toggles hidden files with a pressed button, even when disconnected', async () => {
    const view = render({ enabled: false })
    expect(view.get('button[aria-label="Créer ou envoyer"]').attributes('disabled')).toBeDefined()
    const hidden = view.get('button[aria-label="Afficher les fichiers cachés"]')
    expect(hidden.attributes('aria-pressed')).toBe('true')
    expect(hidden.attributes('disabled')).toBeUndefined()
    await hidden.trigger('click')
    expect(view.emitted('hidden')).toEqual([[]])
  })
  it('routes all creation and upload choices to the existing operations', async () => {
    const view = render()
    for (let index = 0; index < 4; index++) {
      await view.get('button[aria-label="Créer ou envoyer"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      const menu = new DOMWrapper(document.body).get('[role="menu"]')
      await menu.findAll('[role="menuitem"]')[index].trigger('click')
      await flushPromises()
    }
    expect(view.emitted('create')).toEqual([[false], [true]])
    expect(view.emitted('upload')).toEqual([[false], [true]])
  })
  it('shows dock actions only beside a terminal', async () => {
    expect(
      render({ docked: false }).find('button[aria-label="Ouvrir dans un onglet"]').exists(),
    ).toBe(false)
    const view = render()
    await view.get('button[aria-label="Ouvrir dans un onglet"]').trigger('click')
    await view.get('button[aria-label="Masquer l’explorateur distant"]').trigger('click')
    expect(view.emitted('detach')).toEqual([[]])
    expect(view.emitted('hide')).toEqual([[]])
  })
})
