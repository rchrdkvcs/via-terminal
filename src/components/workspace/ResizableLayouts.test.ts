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
  ResizablePanel: { template: '<div><slot /></div>' },
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
})
