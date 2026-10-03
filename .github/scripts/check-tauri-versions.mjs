import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Same rule as @tauri-apps/cli `check_mismatched_packages`: a Rust crate and its
// npm package are compatible when their major and minor versions match.
// `tauri build` exits here, before compilation, on every platform.

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const cargoLock = readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8')
const pnpmLock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8')

const cargoPackages = new Map()
for (const block of cargoLock.split(/\[\[package\]\]\r?\n/)) {
  const name = block.match(/^name = "([^"]+)"/)?.[1]
  const version = block.match(/^version = "([^"]+)"/m)?.[1]
  if (!name || !version) continue
  const versions = cargoPackages.get(name) ?? []
  versions.push(version)
  cargoPackages.set(name, versions)
}

const appBlock = cargoLock.match(
  /\[\[package\]\]\r?\nname = "via-terminal"\r?\nversion = "[^"]+"\r?\ndependencies = \[([\s\S]*?)\]/,
)
if (!appBlock) throw new Error('Could not find via-terminal dependencies in src-tauri/Cargo.lock')

const appDeps = [...appBlock[1].matchAll(/"([^"]+)"/g)].map((match) => {
  const [name, version] = match[1].split(' ')
  return { name, version: version ?? null }
})

function cargoVersion(name, pinned) {
  const versions = cargoPackages.get(name) ?? []
  if (pinned) {
    if (!versions.includes(pinned)) {
      throw new Error(`src-tauri/Cargo.lock has no ${name} ${pinned}`)
    }
    return pinned
  }
  if (versions.length !== 1) {
    throw new Error(`Expected one ${name} crate in src-tauri/Cargo.lock, found ${versions.length}`)
  }
  return versions[0]
}

const importerStart = pnpmLock.indexOf('\n  .:\n')
if (importerStart < 0) throw new Error('Could not find the root importer in pnpm-lock.yaml')
const importerRest = pnpmLock.slice(importerStart + 1)
const importerEnd = importerRest.search(/\n(?! )/)
const importer = importerRest.slice(0, importerEnd === -1 ? importerRest.length : importerEnd)

function npmVersion(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = importer.match(
    new RegExp(
      `\\n      '${escaped}':\\r?\\n        specifier: [^\\r\\n]+\\r?\\n        version: ([0-9][^\\s(]*)`,
    ),
  )
  return match?.[1] ?? null
}

function release(version) {
  const match = /^(\d+)\.(\d+)\./.exec(version)
  if (!match) throw new Error(`Expected a semver version, found ${version}`)
  return `${match[1]}.${match[2]}`
}

const pairs = []
const tauri = appDeps.find((dep) => dep.name === 'tauri')
const api = npmVersion('@tauri-apps/api')
if (!tauri) throw new Error('via-terminal does not depend on the tauri crate')
if (!api) throw new Error('pnpm-lock.yaml does not install @tauri-apps/api')
pairs.push({
  crateName: 'tauri',
  crateVersion: cargoVersion(tauri.name, tauri.version),
  npmName: '@tauri-apps/api',
  npmVersion: api,
})

for (const dep of appDeps) {
  if (!dep.name.startsWith('tauri-plugin-')) continue
  const npmName = `@tauri-apps/plugin-${dep.name.slice('tauri-plugin-'.length)}`
  const npm = npmVersion(npmName)
  if (!npm) continue
  pairs.push({
    crateName: dep.name,
    crateVersion: cargoVersion(dep.name, dep.version),
    npmName,
    npmVersion: npm,
  })
}

const mismatched = pairs.filter((pair) => release(pair.crateVersion) !== release(pair.npmVersion))
if (mismatched.length > 0) {
  const details = mismatched
    .map(
      (pair) => `${pair.crateName} (v${pair.crateVersion}) : ${pair.npmName} (v${pair.npmVersion})`,
    )
    .join('\n')
  console.error(
    `Found version mismatched Tauri packages. Make sure the NPM package and Rust crate versions are on the same major/minor releases:\n${details}`,
  )
  process.exit(1)
}

for (const pair of pairs) {
  console.log(`${pair.crateName} v${pair.crateVersion} matches ${pair.npmName} v${pair.npmVersion}`)
}
