import { expect, it } from 'vitest'
import { connect, deferred, draft, end, native, ready, remoteText } from './files.fixture'
import { useFiles } from './files'
it('does not reopen a document from a session that disconnected during reading', async () => {
  const files = useFiles()
  ready()
  const reading = deferred()
  native.request.mockReturnValueOnce(reading.promise)
  const opening = files.openDocument('tab', '/config')
  end()
  reading.resolve(remoteText())
  await opening
  expect(files.state('tab').documents).toEqual([])
})
it('keeps documents during disconnect and ignores a late directory response', async () => {
  const files = useFiles()
  ready()
  native.request.mockResolvedValueOnce(remoteText())
  await files.openDocument('tab', '/config')
  files.panels.tab.documents[0].content = 'unsaved'
  const listing = deferred()
  native.request.mockReturnValueOnce(listing.promise)
  const navigating = files.navigate('tab', '/private')
  end()
  listing.resolve({ owner: 'server-a', path: '/private', entries: [{ name: 'stale' }] })
  await navigating
  expect(files.state('tab')).toMatchObject({ directory: '.', busy: false })
  expect(files.state('tab').documents[0].content).toBe('unsaved')
  expect(files.connection('tab')).toBeNull()
})

it('keeps a document opening while its directory refreshes', async () => {
  const files = useFiles()
  await connect()
  const reading = deferred()
  native.request.mockReturnValueOnce(reading.promise)
  const opening = files.openDocument('tab', '/config')
  await connect()
  reading.resolve(remoteText('loaded'))
  await opening
  expect(files.state('tab').documents[0]?.content).toBe('loaded')
})
it('applies an explicit reload while its directory refreshes', async () => {
  const files = useFiles()
  const document = await draft('tab', 'local')
  const reading = deferred()
  native.request.mockReturnValueOnce(reading.promise)
  const reloading = files.reloadDocument('tab', document.id)
  await connect()
  reading.resolve(remoteText('remote'))
  await reloading
  expect(document.content).toBe('remote')
  expect(document.original).toBe('remote')
})
