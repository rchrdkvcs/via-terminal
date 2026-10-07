import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { RemoteDocument } from '@/stores/file-documents'
import DocumentTabs from './DocumentTabs.vue'

const document = (id: string, content = 'a'): RemoteDocument => ({
  id,
  owner: 'server',
  path: `/srv/${id}.txt`,
  resolvedPath: `/srv/${id}.txt`,
  content,
  original: 'a',
  permissions: null,
  uid: null,
  gid: null,
  saving: false,
  error: null,
  conflict: false,
})

function render(active = 'one') {
  return mount(DocumentTabs, {
    props: {
      documents: [document('one'), document('two', 'b'), document('three')],
      active,
      panel: 'docs',
    },
    attachTo: window.document.body,
  })
}

describe('DocumentTabs', () => {
  it('keeps only the active document in the tab order and names unsaved ones', () => {
    const tabs = render('two').findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(tabs[1].text()).toContain('non enregistré')
    expect(tabs[0].text()).not.toContain('non enregistré')
  })

  it('moves between documents with arrows, Home and End, wrapping at the edges', async () => {
    const view = render('one')
    const first = view.findAll('[role="tab"]')[0]
    await first.trigger('keydown', { key: 'ArrowLeft' })
    await first.trigger('keydown', { key: 'ArrowRight' })
    await first.trigger('keydown', { key: 'End' })
    await first.trigger('keydown', { key: 'Home' })
    expect(view.emitted('select')).toEqual([['three'], ['two'], ['three'], ['one']])
    view.unmount()
  })

  it('closes the focused document with Delete', async () => {
    const view = render('one')
    await view.findAll('[role="tab"]')[1].trigger('keydown', { key: 'Backspace' })
    expect(view.emitted('close')).toBeUndefined()
    await view.findAll('[role="tab"]')[1].trigger('keydown', { key: 'Delete' })
    expect(view.emitted('close')).toEqual([['two']])
    view.unmount()
  })
})
