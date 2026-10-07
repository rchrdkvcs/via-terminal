import { readFileSync, writeFileSync } from 'node:fs'

const tag = process.argv[2] ?? process.env.RELEASE_TAG
if (!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? '')) {
  throw new Error('Expected a release tag in the format vX.Y.Z')
}
const version = tag.replace(/^v/, '')

const updates = ['package.json', 'src-tauri/tauri.conf.json'].map((path) => {
  const contents = readFileSync(path, 'utf8')
  const config = JSON.parse(contents)
  if (typeof config.version !== 'string') throw new Error(`Missing version in ${path}`)
  return [path, contents.replace(/("version"\s*:\s*")[^"]+(")/g, `$1${version}$2`)]
})
for (const [path, pattern] of [
  ['src-tauri/Cargo.toml', /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/],
  ['src-tauri/Cargo.lock', /(\[\[package\]\]\nname = "via-terminal"\nversion = ")[^"]+(")/],
]) {
  const contents = readFileSync(path, 'utf8')
  if (!pattern.test(contents)) throw new Error(`Could not find application version in ${path}`)
  updates.push([path, contents.replace(pattern, `$1${version}$2`)])
}
for (const [path, contents] of updates) writeFileSync(path, contents)
console.log(`Application version synchronized to ${version}`)
