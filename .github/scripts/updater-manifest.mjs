/** Build one complete Tauri manifest after every platform has uploaded its assets. */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function createUpdaterManifest(release, readSignature) {
  const tag = release.tag_name
  if (!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? ''))
    throw new Error('Expected a stable release tag vX.Y.Z')
  if (release.prerelease) throw new Error('Prereleases must not enter the stable update channel')
  const version = tag.replace(/^v/, '')
  const escapedVersion = version.replaceAll('.', '\\.')
  const targets = {
    'windows-x86_64-nsis': `^Via_${escapedVersion}_x64-setup\\.exe$`,
    'windows-x86_64-msi': `^Via_${escapedVersion}_x64_en-US\\.msi$`,
    'darwin-aarch64': '^Via\\.app\\.tar\\.gz$',
    'linux-x86_64-appimage': `^Via_${escapedVersion}_amd64\\.AppImage$`,
    'linux-x86_64-deb': `^[Vv]ia_${escapedVersion}_amd64\\.deb$`,
  }
  const platforms = {}
  for (const [target, pattern] of Object.entries(targets)) {
    const matches = release.assets.filter((asset) => new RegExp(pattern).test(asset.name))
    if (matches.length !== 1) throw new Error(`Expected exactly one updater artifact for ${target}`)
    const asset = matches[0]
    const sig = release.assets.find((candidate) => candidate.name === `${asset.name}.sig`)
    if (!sig) throw new Error(`Missing signature for ${target}`)
    for (const file of [asset, sig]) {
      if (file.state !== 'uploaded' || !(file.size > 0))
        throw new Error(`Incomplete upload for ${target}`)
    }
    const url = new URL(asset.browser_download_url)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      !url.pathname.endsWith(`/releases/download/${tag}/${asset.name}`)
    )
      throw new Error(`Expected an immutable HTTPS GitHub asset URL for ${target}`)
    const signature = readSignature(sig.name).trim()
    const decoded = Buffer.from(signature, 'base64').toString('utf8').trim().split('\n')
    if (
      !/^[A-Za-z0-9+/]+={0,2}$/.test(signature) ||
      decoded.length !== 4 ||
      !decoded[0].startsWith('untrusted comment:') ||
      !decoded[2].startsWith('trusted comment:') ||
      Buffer.from(decoded[1], 'base64').length !== 74 ||
      Buffer.from(decoded[3], 'base64').length !== 64
    )
      throw new Error(`Invalid signature file for ${target}`)
    platforms[target] = { signature, url: url.toString() }
  }
  const date = release.published_at ?? release.created_at
  if (!Number.isFinite(Date.parse(date))) throw new Error('Missing valid release date')
  return { version, notes: release.body ?? '', pub_date: date, platforms }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [metadata, signatures, output] = process.argv.slice(2)
  if (!metadata || !signatures || !output)
    throw new Error('Usage: updater-manifest.mjs release.json signatures-directory output.json')
  const release = JSON.parse(readFileSync(metadata, 'utf8'))
  const manifest = createUpdaterManifest(release, (name) =>
    readFileSync(join(signatures, basename(name)), 'utf8'),
  )
  writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n')
  console.log(
    `Validated update ${manifest.version} for ${Object.keys(manifest.platforms).length} installer targets`,
  )
}
