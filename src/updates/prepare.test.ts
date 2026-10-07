import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useDraft } from '@/components/vault/useDraft'
import { prepareUpdate } from './prepare'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(invoke).mockReset().mockResolvedValue(undefined)
  Object.assign(window, { __TAURI_INTERNALS__: {} })
})

it('flushes recent settings and organization before closing sessions', async () => {
  const events: string[] = []
  vi.mocked(invoke).mockImplementation(async (command) => {
    events.push(command)
    return undefined
  })
  useSettings().update({ fontSize: 20 })
  useSpaces().create({ name: 'Work', icon: 'terminal', defaultShell: null })
  await prepareUpdate()
  expect(events).toEqual(['settings_save', 'layout_save', 'app_prepare_update'])
})

it('leaves sessions running if a durable save fails', async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'))
  useSettings().update({ fontSize: 20 })
  await expect(prepareUpdate()).rejects.toThrow('disk full')
  expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual(['settings_save'])
  await prepareUpdate()
  expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual([
    'settings_save',
    'settings_save',
    'app_prepare_update',
  ])
})

it('blocks installation for an unsaved new vault record until its editor is closed', async () => {
  const scope = effectScope()
  const editor = scope.run(() =>
    useDraft({ kind: 'host', source: () => ({ id: null, label: '' }) }),
  )!
  editor.draft.value.label = 'Unsaved host'
  await expect(prepareUpdate()).rejects.toThrow('brouillon')
  expect(invoke).not.toHaveBeenCalled()
  scope.stop()
  await prepareUpdate()
  expect(invoke).toHaveBeenCalledWith('app_prepare_update', {})
})
