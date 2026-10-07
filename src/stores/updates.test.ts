import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useUpdates } from './updates'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  Object.assign(window, { __TAURI_INTERNALS__: {} })
})

it('offers the version and release notes returned by the native updater', async () => {
  vi.mocked(check).mockResolvedValue({
    version: '0.3.0',
    body: 'New release',
    close: vi.fn(),
  } as never)
  const updates = useUpdates()
  await updates.check()
  expect(updates.phase).toBe('available')
  expect(updates.version).toBe('0.3.0')
  expect(updates.notes).toBe('New release')
})

it('downloads and verifies before preparing exit and installing, then restarts', async () => {
  const events: string[] = []
  vi.mocked(invoke).mockImplementation(async (command) => {
    events.push(command)
    return undefined
  })
  vi.mocked(relaunch).mockImplementation(async () => {
    events.push('restart')
  })
  vi.mocked(check).mockResolvedValue({
    version: '0.3.0',
    close: vi.fn(),
    download: async (progress: (event: unknown) => void) => {
      events.push('download')
      progress({ event: 'Started', data: { contentLength: 100 } })
      progress({ event: 'Progress', data: { chunkLength: 50 } })
      expect(useUpdates().progress).toBe(50)
    },
    install: async () => {
      events.push('install')
    },
  } as never)
  const updates = useUpdates()
  await updates.check()
  await updates.install()
  expect(events).toEqual([
    'download',
    'app_prepare_update',
    'install',
    'app_prepare_update',
    'restart',
  ])
})

it('does not stop sessions or install when download verification fails', async () => {
  const install = vi.fn()
  vi.mocked(check).mockResolvedValue({
    version: '0.3.0',
    download: vi.fn().mockRejectedValue(new Error('invalid signature')),
    install,
  } as never)
  const updates = useUpdates()
  await updates.check()
  await updates.install()
  expect(updates.phase).toBe('available')
  expect(updates.error).toContain('Invalid signature')
  expect(invoke).not.toHaveBeenCalled()
  expect(install).not.toHaveBeenCalled()
})

it('keeps an available update after an offline check and releases it when replaced', async () => {
  const close = vi.fn(async () => undefined)
  vi.mocked(check).mockResolvedValueOnce({ version: '0.3.0', close } as never)
  const updates = useUpdates()
  await updates.check()
  vi.mocked(check).mockRejectedValueOnce(new Error('offline'))
  await updates.check(true)
  expect(updates.version).toBe('0.3.0')
  expect(updates.error).toContain('Offline')
  expect(close).not.toHaveBeenCalled()
  vi.mocked(check).mockResolvedValueOnce(null)
  await updates.check()
  expect(close).toHaveBeenCalledOnce()
  expect(updates.version).toBe('')
})

it('retries restart without downloading or installing twice', async () => {
  const install = vi.fn(async () => undefined)
  const download = vi.fn(async () => undefined)
  vi.mocked(check).mockResolvedValue({ version: '0.3.0', download, install } as never)
  vi.mocked(invoke).mockResolvedValue(undefined)
  vi.mocked(relaunch)
    .mockRejectedValueOnce(new Error('restart failed'))
    .mockResolvedValue(undefined)
  const updates = useUpdates()
  await updates.check()
  await updates.install()
  expect(updates.phase).toBe('installed')
  await updates.install()
  await updates.restart()
  expect(download).toHaveBeenCalledOnce()
  expect(install).toHaveBeenCalledOnce()
  expect(relaunch).toHaveBeenCalledTimes(2)
})

it('ignores duplicate checks while the native request is pending', async () => {
  let finish!: (update: null) => void
  vi.mocked(check).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const updates = useUpdates()
  const checking = updates.check()
  await updates.check(true)
  expect(check).toHaveBeenCalledOnce()
  finish(null)
  await checking
  expect(updates.phase).toBe('idle')
})

it('checks new changes before retrying a restart after a relaunch failure', async () => {
  const { useSettings } = await import('./settings')
  vi.mocked(check).mockResolvedValue({
    version: '0.3.0',
    download: vi.fn(async () => undefined),
    install: vi.fn(async () => undefined),
  } as never)
  vi.mocked(invoke).mockResolvedValue(undefined)
  vi.mocked(relaunch).mockRejectedValueOnce(new Error('restart failed'))
  const updates = useUpdates()
  await updates.check()
  await updates.install()
  useSettings().update({ fontSize: 20 })
  vi.mocked(invoke).mockRejectedValueOnce(new Error('save failed'))
  await updates.restart()
  expect(updates.phase).toBe('installed')
  expect(updates.error).toContain('Save failed')
  expect(relaunch).toHaveBeenCalledOnce()
  await updates.restart()
  expect(relaunch).toHaveBeenCalledTimes(2)
})
