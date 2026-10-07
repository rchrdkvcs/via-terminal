import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createUpdaterManifest } from './updater-manifest.mjs'

const names = [
  'Via_0.4.0_x64-setup.exe',
  'Via_0.4.0_x64_en-US.msi',
  'Via.app.tar.gz',
  'Via_0.4.0_amd64.AppImage',
  'Via_0.4.0_amd64.deb',
]
const asset = (name) => ({
  name,
  size: 100,
  state: 'uploaded',
  browser_download_url: `https://github.com/rchrdkvcs/via-terminal/releases/download/v0.4.0/${name}`,
})
const release = () => ({
  tag_name: 'v0.4.0',
  body: 'Release notes',
  published_at: '2026-10-07T10:00:00Z',
  assets: names.flatMap((name) => [asset(name), asset(`${name}.sig`)]),
})
const signature = Buffer.from(
  'untrusted comment: signature\n' +
    Buffer.alloc(74).toString('base64') +
    '\ntrusted comment: timestamp:1\n' +
    Buffer.alloc(64).toString('base64') +
    '\n',
).toString('base64')

test('publishes a complete manifest with versioned URLs and the matching installer types', () => {
  const manifest = createUpdaterManifest(release(), () => signature)
  assert.equal(manifest.version, '0.4.0')
  assert.equal(manifest.notes, 'Release notes')
  assert.deepEqual(Object.keys(manifest.platforms).sort(), [
    'darwin-aarch64',
    'linux-x86_64-appimage',
    'linux-x86_64-deb',
    'windows-x86_64-msi',
    'windows-x86_64-nsis',
  ])
  assert.equal(
    manifest.platforms['windows-x86_64-nsis'].url,
    'https://github.com/rchrdkvcs/via-terminal/releases/download/v0.4.0/Via_0.4.0_x64-setup.exe',
  )
  assert.equal(manifest.platforms['linux-x86_64-deb'].signature, signature)
})

test('rejects partial releases, empty artifacts and absent signatures', () => {
  for (const removed of names.flatMap((name) => [name, `${name}.sig`])) {
    const partial = release()
    partial.assets = partial.assets.filter((file) => file.name !== removed)
    assert.throws(() => createUpdaterManifest(partial, () => signature), /artifact|signature/)
  }
  const incomplete = release()
  incomplete.assets[0].size = 0
  assert.throws(() => createUpdaterManifest(incomplete, () => signature), /Incomplete/)
})

test('rejects an invalid signature and mutable or insecure download URLs', () => {
  assert.throws(() => createUpdaterManifest(release(), () => ''), /Invalid signature/)
  for (const url of [
    'http://github.com/release.exe',
    'https://github.com/rchrdkvcs/via-terminal/releases/latest/download/Via_0.4.0_x64-setup.exe',
  ]) {
    const invalid = release()
    invalid.assets[0].browser_download_url = url
    assert.throws(() => createUpdaterManifest(invalid, () => signature), /HTTPS/)
  }
})

test('rejects duplicate targets, prereleases and artifacts from another version', () => {
  const duplicate = release()
  duplicate.assets.push(asset(names[0]))
  assert.throws(() => createUpdaterManifest(duplicate, () => signature), /exactly one/)
  assert.throws(
    () => createUpdaterManifest({ ...release(), prerelease: true }, () => signature),
    /Prereleases/,
  )
  assert.throws(
    () => createUpdaterManifest({ ...release(), tag_name: 'v0.5.0' }, () => signature),
    /artifact/,
  )
})
