import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFiles } from './files'
const native = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/ipc/files', () => ({ filesApi: native }))
beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})
it('does not reopen a document from a session that disconnected during reading', async () => {
  const files = useFiles()
  let complete!: (value: unknown) => void
  native.request.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  const opening = files.openDocument('tab', 'old-session', '/config')
  files.disconnect('tab')
  complete({ path: '/config', resolvedPath: '/config', content: 'old' })
  await opening
  expect(files.state('tab').documents).toEqual([])
})
it('keeps documents during disconnect and ignores a late directory response', async () => {
  const files = useFiles()
  native.request.mockResolvedValueOnce({ path: '/config', resolvedPath: '/config', content: 'old' })
  await files.openDocument('tab', 'old-session', '/config')
  files.state('tab').documents[0].content = 'unsaved'
  let complete!: (value: unknown) => void
  native.request.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  const navigating = files.navigate('tab', 'old-session', '/private')
  files.disconnect('tab')
  complete({ path: '/private', entries: [{ name: 'stale' }] })
  await navigating
  expect(files.state('tab').directory).toBe('.')
  expect(files.state('tab').documents[0].content).toBe('unsaved')
  expect(files.state('tab').sessionId).toBeNull()
})
