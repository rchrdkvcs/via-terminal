import { expect, it, vi } from 'vitest'
import { draft, end, native, reconnect } from '@/stores/files.fixture'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useFileProtection } from './useFileProtection'

/** Answers the next explorer question once it is shown, and returns it. */
async function reply(choice: string) {
  const dialogs = useFileDialogs()
  await vi.waitFor(() => expect(dialogs.current).not.toBeNull())
  const question = dialogs.current!
  dialogs.answer({ choice, value: '', all: false })
  return question
}

it('cancelling a later document keeps an earlier discarded draft', async () => {
  const first = await draft('first', 'first draft')
  const second = await draft('second', 'second draft')
  const deciding = useFileProtection().protect(['first', 'second'])
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
  await files.startTransfer('tab', {
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
  expect(files.document('tab')!.content).toBe('edited after deciding')
  const close = vi.fn(() => true)
  const confirmed = protection.release(decision, close)
  await reply('discard')
  expect(await confirmed).toBe(true)
  expect(close).toHaveBeenCalledOnce()
})

/** Asks to close the tab and returns the offered actions, then cancels. */
async function offered() {
  const deciding = useFileProtection().protect(['tab'])
  const question = await reply('cancel')
  expect(await deciding).toBeNull()
  return { actions: question.actions.map((action) => action.value), question }
}

it('never offers to save a draft once the tab reconnected to another endpoint or account', async () => {
  await draft()
  end()
  await reconnect('tab', 'session-b', 'server-b')
  const { actions, question } = await offered()
  expect(actions).toEqual(['discard'])
  expect(question.description).toContain('Le serveur ou le compte a changé')
})

it('offers to save a draft again once the tab reconnected to its own endpoint and account', async () => {
  const document = await draft()
  end()
  expect((await offered()).actions).toEqual(['discard'])
  await reconnect()
  expect((await offered()).actions).toEqual(['save', 'discard'])
  expect(document.content).toBe('draft')
})
