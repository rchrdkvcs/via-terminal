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
it('browses another directory without moving the explorer, and drops a stale reply', async () => {
  const files = useFiles()
  await connect()
  const entries = [{ name: 'nginx', path: '/etc/nginx', kind: 'directory' }]
  native.request.mockResolvedValueOnce({ owner: 'server-a', path: '/etc', entries })
  expect(await files.browse('tab', '/etc')).toEqual(entries)
  expect(native.request).toHaveBeenLastCalledWith('session', { operation: 'list', path: '/etc' })
  expect(files.state('tab')).toMatchObject({ directory: '/', busy: false })
  const listing = deferred()
  native.request.mockReturnValueOnce(listing.promise)
  const browsing = files.browse('tab', '/srv')
  end()
  listing.resolve({ owner: 'server-a', path: '/srv', entries })
  expect(await browsing).toBeNull()
  expect(await files.browse('tab', '/srv')).toBeNull()
})
