import { expect, it, vi } from 'vitest'
import { draft, native } from '@/stores/files.fixture'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useFileProtection } from './useFileProtection'

vi.mock('@/stores/sessions', () => ({
  useSessions: () => ({ runtime: () => ({ state: 'asleep', sessionId: null }) }),
}))

/** Answers the next explorer question once it is shown, and returns it. */
async function reply(choice: string) {
  const dialogs = useFileDialogs()
  await vi.waitFor(() => expect(dialogs.current).not.toBeNull())
  const question = dialogs.current!
  dialogs.answer({ choice, value: '', all: false })
  return question
}

it('cancelling a later document keeps an earlier discarded draft', async () => {
  const first = await draft('tab', 'first draft', '/first')
  const second = await draft('tab', 'second draft', '/second')
  const deciding = useFileProtection().protect(['tab'])
  await reply('discard')
  await reply('cancel')
  expect(await deciding).toBeNull()
  expect(first.content).toBe('first draft')
  expect(second.content).toBe('second draft')
})

it('cancelling the transfer stop keeps discarded drafts and transfers', async () => {
  const files = useFiles()
  const document = await draft()
  native.request.mockResolvedValueOnce(null)
  await files.startTransfer('tab', 'session', {
    direction: 'upload',
    sources: ['/a'],
    destination: '/',
  })
  const deciding = useFileProtection().protect(['tab'])
  await reply('discard')
  expect((await reply('cancel')).title).toContain('transferts')
  expect(await deciding).toBeNull()
  expect(document.content).toBe('draft')
  expect(files.hasTransfers('tab')).toBe(true)
})

it('drafts are lost only when the closing succeeds, and later edits are asked again', async () => {
  const files = useFiles()
  const protection = useFileProtection()
  const document = await draft()
  const deciding = protection.protect(['tab'])
  await reply('discard')
  const decision = (await deciding)!
  expect(await protection.release(decision, () => false)).toBe(false)
  expect(document.content).toBe('draft')
  document.content = 'edited after deciding'
  const releasing = protection.release(decision, () => true)
  await reply('cancel')
  expect(await releasing).toBe(false)
  expect(files.panels.tab.documents[0].content).toBe('edited after deciding')
  const close = vi.fn(() => true)
  const confirmed = protection.release(decision, close)
  await reply('discard')
  expect(await confirmed).toBe(true)
  expect(close).toHaveBeenCalledOnce()
  expect(files.panels.tab).toBeUndefined()
})

it('never offers to save a draft through another endpoint or account', async () => {
  const files = useFiles()
  await draft()
  files.state('tab').owner = 'server-b'
  const deciding = useFileProtection().protect(['tab'])
  const question = await reply('cancel')
  expect(question.actions.map((action) => action.value)).toEqual(['discard'])
  expect(await deciding).toBeNull()
})
