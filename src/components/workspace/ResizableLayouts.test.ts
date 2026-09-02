import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import PaneLayout from './PaneLayout.vue'
import SplitGroupLayout from './SplitGroupLayout.vue'
import { useAppStore, type PaneNode, type RuntimeSplitTree } from '@/stores/app'

const ResizablePanelGroupStub = defineComponent({
  name: 'ResizablePanelGroup',
  emits: ['layout'],
  template: '<div><slot /></div>',
})

const stubs = {
  ResizablePanelGroup: ResizablePanelGroupStub,
  ResizablePanel: { template: '<div data-panel><slot /></div>' },
  ResizableHandle: true,
  TerminalPane: true,
}

describe('resizable terminal layouts', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('persists a pane layout emitted as percentages', async () => {
    const node: PaneNode = {
      kind: 'split',
      id: 'split',
      direction: 'vertical',
      ratio: 0.5,
      first: { kind: 'pane', id: 'first', sessionId: 'one' },
      second: { kind: 'pane', id: 'second', sessionId: 'two' },
    }
    const store = useAppStore()
    const setRatio = vi.spyOn(store, 'setSplitRatio')
    const wrapper = mount(PaneLayout, { props: { node, closable: true }, global: { stubs } })

    wrapper.findComponent(ResizablePanelGroupStub).vm.$emit('layout', [35, 65])
    await wrapper.vm.$nextTick()

    expect(setRatio).toHaveBeenCalledWith('split', 0.35)
  })

  it('persists a linked group layout emitted as percentages', async () => {
    const node: RuntimeSplitTree = {
      kind: 'split',
      id: 'group-split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { kind: 'tab', tabId: 'one' },
      second: { kind: 'tab', tabId: 'two' },
    }
    const store = useAppStore()
    const setRatio = vi.spyOn(store, 'setGroupSplitRatio')
    const wrapper = mount(SplitGroupLayout, { props: { node }, global: { stubs } })

    wrapper.findComponent(ResizablePanelGroupStub).vm.$emit('layout', [60, 40])
    await wrapper.vm.$nextTick()

    expect(setRatio).toHaveBeenCalledWith('group-split', 0.6)
  })

  it('lets every panel fill the available height', () => {
    const store = useAppStore()
    store.tabs.push(
      {
        id: 'one',
        root: { kind: 'pane', id: 'first', sessionId: 'one' },
      } as (typeof store.tabs)[number],
      {
        id: 'two',
        root: { kind: 'pane', id: 'second', sessionId: 'two' },
      } as (typeof store.tabs)[number],
    )
    const paneNode: PaneNode = {
      kind: 'split',
      id: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { kind: 'pane', id: 'first', sessionId: 'one' },
      second: { kind: 'pane', id: 'second', sessionId: 'two' },
    }
    const groupNode: RuntimeSplitTree = {
      kind: 'split',
      id: 'group-split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { kind: 'tab', tabId: 'one' },
      second: { kind: 'tab', tabId: 'two' },
    }
    const wrappers = [
      mount(PaneLayout, { props: { node: paneNode, closable: true }, global: { stubs } }),
      mount(SplitGroupLayout, { props: { node: groupNode }, global: { stubs } }),
    ]

    for (const wrapper of wrappers)
      for (const panel of wrapper.findAll('[data-panel]'))
        expect(panel.classes()).toEqual(expect.arrayContaining(['flex', 'min-h-0', 'min-w-0']))
  })
})
