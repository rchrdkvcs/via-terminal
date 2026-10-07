import { expect, it, vi } from 'vitest'
import { draft } from '@/stores/files.fixture'
import { mocks, row, setup } from '@/stores/workbench.fixture'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import { useTabClosing } from './useTabClosing'

async function discardThenAskToClose() {
  setup([], [row('tab')])
  mocks.live.add('tab')
  useSettings().settings.confirmCloseRunning = true
  const document = await draft()
  const closing = useTabClosing().close('tab')
  await vi.waitFor(() => expect(useFileDialogs().current).not.toBeNull())
  useFileDialogs().answer({ choice: 'discard', value: '', all: false })
  await closing
  expect(useUi().confirmation).not.toBeNull()
  return document
}

it('cancelling the running-session confirmation keeps a draft chosen for discard', async () => {
  const document = await discardThenAskToClose()
  useUi().confirmation = null
  expect(document.content).toBe('draft')
  expect(useFiles().panels.tab.documents).toHaveLength(1)
})

it('confirming the running-session question closes the tab and its explorer', async () => {
  await discardThenAskToClose()
  useUi().confirmation!.run()
  await vi.waitFor(() => expect(useFiles().panels.tab).toBeUndefined())
  expect(mocks.release).toHaveBeenCalledWith('tab')
})
