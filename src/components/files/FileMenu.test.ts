import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import FileMenu from './FileMenu.vue'

const views: ReturnType<typeof mount>[] = []
afterEach(() => {
  views.splice(0).forEach((view) => view.unmount())
  document.body.innerHTML = ''
})

async function open(props: { count: number; enabled?: boolean; docked?: boolean }) {
  const events: string[] = []
  const Host = defineComponent(
    () => () =>
      h(ContextMenu, null, () => [
        h(ContextMenuTrigger, { asChild: true }, () => h('div', { id: 'area' })),
        h(FileMenu, {
          enabled: true,
          hidden: false,
          docked: false,
          ...props,
          onRemove: () => events.push('remove'),
          onCreate: (directory: boolean) => events.push(`create:${directory}`),
        }),
      ]),
  )
  const view = mount(Host, { attachTo: document.body })
  views.push(view)
  await view.get('#area').trigger('contextmenu', { button: 2 })
  await flushPromises()
  const menu = new DOMWrapper(document.body).get('[role="menu"]')
  const items = menu.findAll('[role="menuitem"], [role="menuitemcheckbox"]')
  const disabled = (label: string) =>
    items.find((item) => item.text().startsWith(label))?.attributes('data-disabled') !== undefined
  return { menu, items, events, disabled }
}

describe('FileMenu', () => {
  it('acts on a single entry', async () => {
    const { menu, disabled } = await open({ count: 1 })
    expect(menu.text()).toContain('Copier le chemin')
    expect(disabled('Ouvrir')).toBe(false)
    expect(disabled('Renommer')).toBe(false)
  })
  it('keeps only bulk actions for a multiple selection', async () => {
    const { menu, items, events, disabled } = await open({ count: 3 })
    expect(menu.text()).toContain('Supprimer 3 éléments')
    expect(disabled('Ouvrir')).toBe(true)
    expect(disabled('Renommer')).toBe(true)
    expect(disabled('Télécharger')).toBe(false)
    await items.find((item) => item.text().startsWith('Supprimer'))!.trigger('click')
    expect(events).toEqual(['remove'])
  })
  it('offers creation on the empty list and dock actions beside a terminal', async () => {
    const { menu, items, events } = await open({ count: 0, docked: true })
    expect(menu.text()).toContain('Afficher les fichiers cachés')
    expect(menu.text()).toContain('Masquer l’explorateur distant')
    await items[1].trigger('click')
    expect(events).toEqual(['create:true'])
  })
  it('disables file operations while disconnected', async () => {
    const { disabled } = await open({ count: 1, enabled: false })
    expect(disabled('Télécharger')).toBe(true)
    expect(disabled('Copier le chemin')).toBe(false)
  })
})
