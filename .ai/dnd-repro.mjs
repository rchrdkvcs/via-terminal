/**
 * Drag and drop check against the running Tauri window over CDP.
 *
 * Start the app with:
 *   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 pnpm tauri dev
 *
 * Every drag is driven with real mouse events, the way the user performs it,
 * because that is the path the native drop target of the webview used to eat.
 * Nothing is simulated inside the page.
 *
 * The run works in a scratch workspace, but it writes to the live database.
 * Back it up first:
 *   cp "$APPDATA/dev.terminarr.desktop/terminarr.sqlite" .ai/terminarr-backup.sqlite
 */
const PORT = process.env.CDP_PORT ?? '9333'

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:1420'))
if (!page) throw new Error(`no Terminarr page target: ${JSON.stringify(targets.map((t) => t.url))}`)

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve))

let nextId = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id === undefined) return
  pending.get(message.id)?.(message)
  pending.delete(message.id)
})

function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve) => {
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  const details = response.result?.exceptionDetails
  if (details) throw new Error(details.exception?.description ?? details.text)
  return response.result?.result?.value
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let failures = 0
function check(name, ok, detail = '') {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`      ${detail}`)
}

const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')`

// Saving this file makes Vite reload the page, so wait for the app to mount.
for (
  let attempt = 0;
  attempt < 40 && !(await evaluate(`Boolean(document.querySelector('#app')?.__vue_app__)`));
  attempt++
)
  await wait(500)

const TABS = '[role="tablist"]'
const TREE = '[aria-label^="Organisation"]'
const PINNED = '[aria-label^="Favoris"]'

/** A point inside a row of one area; `bias` picks the before / into / after band. */
async function rowPoint(scope, label, bias = 0.5) {
  const point = await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(scope)})
    const node = [...(root?.querySelectorAll('[data-sidebar="menu-button"]') ?? [])]
      .find((n) => n.textContent.trim() === ${JSON.stringify(label)})
    if (!node) return null
    const r = node.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height * ${bias}) }
  })()`)
  if (!point) throw new Error(`no row «${label}» in ${scope}`)
  return point
}

/** The blank strip under the rows of an area, which appends to it. */
async function areaPoint(scope) {
  const point = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(scope)})
    if (!node) return null
    const r = node.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.bottom - 4) }
  })()`)
  if (!point) throw new Error(`no area ${scope}`)
  return point
}

async function drag(from, to) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...from,
    button: 'left',
    clickCount: 1,
  })
  for (let step = 1; step <= 12; step++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(from.x + ((to.x - from.x) * step) / 12),
      y: Math.round(from.y + ((to.y - from.y) * step) / 12),
      button: 'left',
      buttons: 1,
    })
    await wait(25)
  }
  // Hover a moment on the target, as a hand does before letting go.
  for (let frame = 0; frame < 3; frame++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...to, button: 'left', buttons: 1 })
    await wait(60)
  }
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...to,
    button: 'left',
    clickCount: 1,
  })
  await wait(900)
}

const state = () =>
  evaluate(`({
    favorites: ${store}.favorites.map((f) => f.label),
    tree: ${store}.tree.map((n) => ({ label: n.label, children: n.children.map((c) => c.label) })),
    tabs: ${store}.unfavoritedTabs.map((t) => t.name),
    markers: document.querySelectorAll('[class*="ring-2 ring-sidebar-ring"]').length,
  })`)

const roots = (s) => s.tree.map((n) => n.label)

// ---- a scratch workspace, so the real organization is never touched ---------
await evaluate(`${store}.workspaceContentCollapsed && ${store}.toggleWorkspaceContent()`)
await evaluate(`${store}.createWorkspace('DnD check')`)
await wait(1500)
await evaluate(`${store}.createFolder('Dossier')`)
await wait(800)
for (const name of ['Alpha', 'Gamma', 'Delta'])
  await evaluate(
    `${store}.createLocalProfile({ name: '${name}', executable: 'powershell.exe', args: [], workingDirectory: null, parentId: null })`,
  )
await wait(1500)
await evaluate(`${store}.renamingNodeId = null`)

const profile = (name) => `${store}.workspaceProfiles.find((p) => p.name === '${name}').id`
await evaluate(`${store}.createTerminal(${profile('Alpha')})`)
await wait(2500)

let now = await state()
check(
  'the scratch workspace shows one open tab, a folder and its rows',
  now.tabs.length === 1 && roots(now).includes('Dossier') && now.favorites.length === 0,
  JSON.stringify(now),
)

// ---- 1. an open tab into the favourites -------------------------------------
await drag(await rowPoint(TABS, 'Alpha'), await areaPoint(PINNED))
now = await state()
check(
  'an open tab dropped on the favourites is pinned there',
  now.favorites.includes('Alpha') && !now.tabs.includes('Alpha'),
  JSON.stringify(now),
)

// ---- 2. a favourite back out into the tree ----------------------------------
await drag(await rowPoint(PINNED, 'Alpha'), await areaPoint(TREE))
now = await state()
check(
  'a favourite dropped in the tree stops being pinned',
  now.favorites.length === 0 && roots(now).includes('Alpha'),
  JSON.stringify(now),
)

// ---- 3. a row into a folder -------------------------------------------------
await drag(await rowPoint(TREE, 'Alpha'), await rowPoint(TREE, 'Dossier', 0.5))
now = await state()
check(
  'a row dropped on the middle of a folder goes inside it',
  Boolean(now.tree.find((n) => n.label === 'Dossier')?.children.includes('Alpha')),
  JSON.stringify(now.tree),
)

// ---- 4. a row out of a folder back to the root ------------------------------
await drag(await rowPoint(TREE, 'Alpha'), await areaPoint(TREE))
now = await state()
check(
  'a row dropped on the blank tree area leaves its folder',
  roots(now).includes('Alpha') && !now.tree.find((n) => n.label === 'Dossier')?.children.length,
  JSON.stringify(now.tree),
)

// ---- 5. reordering the tree -------------------------------------------------
const anchor = roots(await state()).find((label) => label !== 'Alpha')
await drag(await rowPoint(TREE, 'Alpha'), await rowPoint(TREE, anchor, 0.1))
now = await state()
check(
  `a row dropped on the top edge of «${anchor}» is inserted before it`,
  roots(now).indexOf('Alpha') === roots(now).indexOf(anchor) - 1,
  JSON.stringify(roots(now)),
)

// ---- 6. reordering the open tabs --------------------------------------------
for (const name of ['Gamma', 'Delta']) {
  await evaluate(`${store}.createTerminal(${profile(name)})`)
  await wait(2200)
}
const opened = (await state()).tabs
check('two more open tabs are listed', opened.length === 2, JSON.stringify(opened))
if (opened.length === 2) {
  await drag(await rowPoint(TABS, opened[1]), await rowPoint(TABS, opened[0], 0.1))
  now = await state()
  check(
    'an open tab dropped on the top edge of another is reordered',
    now.tabs[0] === opened[1] && now.tabs[1] === opened[0],
    `${JSON.stringify(opened)} -> ${JSON.stringify(now.tabs)}`,
  )
}

// ---- 7. a folder cannot swallow itself --------------------------------------
await drag(await rowPoint(TREE, 'Dossier'), await rowPoint(TREE, 'Dossier', 0.5))
now = await state()
check(
  'a folder dropped on itself is refused',
  roots(now).includes('Dossier'),
  JSON.stringify(roots(now)),
)

check('no drop marker survives the gesture', (await state()).markers === 0)

console.log(failures ? `\n${failures} failed` : '\nall checks passed')
socket.close()
process.exit(failures ? 1 : 0)
