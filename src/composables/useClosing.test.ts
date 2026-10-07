import { expect, it, vi } from 'vitest'
import { draft } from '@/stores/files.fixture'
import { mocks, row, setup } from '@/stores/workbench.fixture'
import { findTab } from '@/domain/space'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useClosing } from './useClosing'

const replacement = { kind: 'host', hostId: 'other' } as const
const prepare = vi.fn(async () => undefined)

/** Each intent, whether it asks for a confirmation, and what it changes once it happened. */
const intents = [
  {
    intent: 'close tab',
    confirms: true,
    run: () => useClosing().closeTab('tab'),
    happened: () => !findTab(useSpaces().byId('one')!, 'tab'),
  },
  {
    intent: 'replace tab',
    confirms: false,
    run: () => useClosing().replaceTab('tab', replacement),
    happened: () => findTab(useSpaces().byId('one')!, 'tab')?.target.kind === 'host',
  },
  {
    intent: 'remove space',
    confirms: true,
    run: () => useClosing().removeSpace('one'),
    happened: () => !useSpaces().byId('one'),
  },
  {
    intent: 'quit',
    confirms: false,
    run: () => useClosing().leave(prepare),
    happened: () => prepare.mock.calls.length > 0,
  },
]

async function answer(choice: string) {
  const dialogs = useFileDialogs()
  await vi.waitFor(() => expect(dialogs.current).not.toBeNull())
  dialogs.answer({ choice, value: '', all: false })
}

/** The explorer store reads the fake sessions of `draft`, the workbench reads `mocks`. */
async function withDraft() {
  const document = await draft()
  setup([], [row('tab')])
  mocks.live.add('tab')
  useSettings().settings.confirmCloseRunning = true
  prepare.mockClear()
  return document
}

it.each(intents)('$intent: cancelling the draft question changes nothing', async (intent) => {
  const document = await withDraft()
  const running = intent.run()
  await answer('cancel')
  await running
  expect(intent.happened()).toBe(false)
  expect(useUi().confirmation).toBeNull()
  expect(document.content).toBe('draft')
  expect(mocks.live.has('tab')).toBe(true)
})

it.each(intents.filter((intent) => intent.confirms))(
  '$intent: dismissing the confirmation keeps a draft chosen for discard',
  async (intent) => {
    const document = await withDraft()
    const running = intent.run()
    await answer('discard')
    await running
    expect(useUi().confirmation).not.toBeNull()
    useUi().confirmation = null
    expect(intent.happened()).toBe(false)
    expect(useFiles().panels.tab.documents).toEqual([document])
    expect(document.content).toBe('draft')
  },
)

it.each(intents)('$intent: happens once agreed, and releases explorers it ends', async (intent) => {
  await withDraft()
  const running = intent.run()
  await answer('discard')
  await running
  if (intent.confirms) useUi().confirmation!.run()
  await vi.waitFor(() => expect(intent.happened()).toBe(true))
  if (intent.intent === 'quit') {
    expect(useFiles().panels.tab.documents).toHaveLength(1)
    return
  }
  expect(useFiles().panels.tab).toBeUndefined()
  expect([...mocks.stop.mock.calls, ...mocks.release.mock.calls]).toEqual([['tab']])
})

it('quit asks again when a draft changed while preparing', async () => {
  const document = await withDraft()
  prepare.mockImplementationOnce(async () => {
    document.content = 'edited while flushing'
  })
  const leaving = useClosing().leave(prepare)
  await answer('discard')
  await answer('discard')
  expect(await leaving).toBe(true)
  expect(prepare).toHaveBeenCalledTimes(2)
})

it('replacing a tab starts its new target after releasing the explorer', async () => {
  await withDraft()
  const replacing = useClosing().replaceTab('tab', replacement)
  await answer('discard')
  await replacing
  expect(useFiles().panels.tab).toBeUndefined()
  expect(mocks.start).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'tab', target: replacement }),
    'first-shell',
  )
})
