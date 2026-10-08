import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { FileState } from '@/stores/files'
import FileNavigation from './FileNavigation.vue'
const panel: FileState = {
  owner: undefined,
  visible: true,
  directory: '/srv/releases/',
  entries: [],
  busy: false,
  error: null,
}
describe('FileNavigation', () => {
  it('navigates to the parent and refreshes the current directory without a title row', async () => {
    const view = mount(FileNavigation, { props: { panel, connected: true } })
    expect(view.find('h2').exists()).toBe(false)
    await view.get('[aria-label="Dossier parent"]').trigger('click')
    await view.get('[aria-label="Actualiser les fichiers"]').trigger('click')
    expect(view.emitted('navigate')).toEqual([['/srv'], ['/srv/releases/']])
    await view.setProps({ panel: { ...panel, directory: '/', busy: true } })
    expect(view.get('[aria-label="Dossier parent"]').attributes('disabled')).toBeDefined()
    expect(view.get('[aria-label="Actualiser les fichiers"]').attributes('disabled')).toBeDefined()
    view.unmount()
  })
})
