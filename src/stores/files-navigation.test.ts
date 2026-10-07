import { expect, it } from 'vitest'
import { connect, deferred, end, native } from './files.fixture'
import { useFiles } from './files'
it('ignores a directory listing answered after a disconnect', async () => {
  const files = useFiles()
  await connect()
  const listing = deferred()
  native.request.mockReturnValueOnce(listing.promise)
  const navigating = files.navigate('tab', '/private')
  end()
  listing.resolve({ owner: 'server-a', path: '/private', entries: [{ name: 'stale' }] })
  await navigating
  expect(files.state('tab')).toMatchObject({ directory: '/', busy: false })
  expect(files.connection('tab')).toBeNull()
})
