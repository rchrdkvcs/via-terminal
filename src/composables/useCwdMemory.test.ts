import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { Row } from '@/ipc/types'
import { findTab } from '@/domain/space'
import { mocks, row, setup } from '@/stores/workbench.fixture'
import { useSettings } from '@/stores/settings'
import { useCwdMemory } from './useCwdMemory'

function at(id: string, cwd: string): Row {
  return { ...row(id), target: { kind: 'local', shell: null, cwd } }
}

function start(pinned: Row[], temporary: Row[]) {
  const { spaces, workbench } = setup(pinned, temporary)
  useSettings().platform = 'macos'
  for (const tab of [...pinned, ...temporary]) mocks.live.add(tab.id)
  const remember = useCwdMemory()
  const cd = async (tabId: string, path: string) => {
    remember(tabId, `file://localhost${path}`, 7)
    await nextTick()
  }
  const cwd = (tabId: string) => {
    const target = findTab(spaces.byId('one')!, tabId)!.target
    return target.kind === 'local' ? target.cwd : null
  }
  return { cd, cwd, workbench }
}

it('a temporary tab follows the shell directory', async () => {
  const { cd, cwd } = start([], [row('tab')])
  await cd('tab', '/lab/dossier/src')
  expect(cwd('tab')).toBe('/lab/dossier/src')
})

it('a pinned tab keeps the directory it was pinned with', async () => {
  const { cd, cwd } = start([at('tab', '/lab/dossier')], [])
  await cd('tab', '/lab/dossier/src')
  expect(cwd('tab')).toBe('/lab/dossier')
})

it('pinning captures the directory at that moment', async () => {
  const { cd, cwd, workbench } = start([], [row('tab')])
  await cd('tab', '/lab/dossier')
  workbench.togglePin('tab')
  await cd('tab', '/lab/dossier/src')
  expect(cwd('tab')).toBe('/lab/dossier')
})

it('unpinning picks up where the shell currently is', async () => {
  const { cd, cwd, workbench } = start([at('tab', '/lab/dossier')], [])
  await cd('tab', '/lab/dossier/src')
  workbench.togglePin('tab')
  await nextTick()
  expect(cwd('tab')).toBe('/lab/dossier/src')
})
