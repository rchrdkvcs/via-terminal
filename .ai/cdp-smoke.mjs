/**
 * End-to-end smoke check against the running Tauri window over CDP.
 *
 * Start the app with:
 *   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 pnpm tauri dev
 *
 * The WebGL renderer paints to a canvas, so terminal contents are read through
 * the dev-only `window.__viaTerminal` handle rather than the DOM. The interface is
 * driven by accessible name, so moving a control between the sidebar and the
 * top bar does not break the check.
 */
const PORT = process.env.CDP_PORT ?? '9333'

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:1420'))
if (!page) throw new Error(`no via terminal page target: ${JSON.stringify(targets.map((t) => t.url))}`)

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve))

let nextId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  const resolve = pending.get(message.id)
  if (resolve) {
    pending.delete(message.id)
    resolve(message)
  }
})

function send(method, params) {
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
  if (details) return { error: details.exception?.description ?? details.text }
  return response.result?.result?.value
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let failures = 0
function check(name, ok, detail = '') {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok && detail) console.log(`      ${detail}`)
}

const helpers = [
  'window.__smokeErrors = window.__smokeErrors ?? [];',
  "window.addEventListener('error', (e) => window.__smokeErrors.push(String(e.message)));",
  "window.addEventListener('unhandledrejection', (e) => window.__smokeErrors.push(String(e.reason)));",
  "window.__store = () => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.app;",
  'window.__clickText = (text) => {',
  "  const node = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));",
  "  if (!node) throw new Error('no button named ' + text);",
  '  node.click();',
  '  return true;',
  '};',
  'window.__clickLabel = (label) => {',
  '  const node = document.querySelector(`[aria-label="${label}"]`);',
  "  if (!node) throw new Error('no control labelled ' + label);",
  '  node.click();',
  '  return true;',
  '};',
  'window.__buffer = (id) => window.__viaTerminal.terminals.readBuffer(id);',
].join('\n')

await evaluate(helpers)

const boot = await evaluate(`(() => {
  const store = window.__store()
  return {
    title: document.title,
    workspace: store.workspaces.find((w) => w.id === store.activeWorkspaceId)?.name ?? null,
    hasRegistry: Boolean(window.__viaTerminal),
    sidebarRows: document.querySelectorAll('[data-sidebar="menu-button"]').length,
  }
})()`)
check(
  'window boots with the persisted workspace and the sidebar',
  Boolean(boot.workspace) && boot.hasRegistry && boot.sidebarRows > 0,
  JSON.stringify(boot),
)

await evaluate('window.__clickText("Nouvel onglet")')
await wait(300)
await evaluate(`(() => {
  const store = window.__store();
  const profile = store.workspaceProfiles.find((p) => p.id === store.defaultProfileId);
  const button = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes(profile.name));
  if (!button) throw new Error('default local profile is missing from the new-tab picker');
  button.click();
})()`)
await wait(3000)

const rendered = await evaluate(
  "document.querySelector('.terminal-surface canvas, .terminal-surface .xterm-rows') ? 'rendered' : 'missing'",
)
check('a renderer is attached to the pane', rendered === 'rendered', String(rendered))

const ids = await evaluate('window.__store().sessions.map((s) => s.id)')
check(
  'the store registered exactly one session',
  Array.isArray(ids) && ids.length === 1,
  JSON.stringify(ids),
)

const first = Array.isArray(ids) ? ids[0] : null
const banner = first ? await evaluate(`window.__buffer(${JSON.stringify(first)}).trim()`) : ''
check(
  'the PTY streamed a shell prompt',
  typeof banner === 'string' && banner.length > 0,
  String(banner).slice(0, 200),
)

// The open session must be listed in the sidebar, not in a top tab bar.
const sidebarTabs = await evaluate(`(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')]
  return {
    count: tabs.length,
    insideSidebar: tabs.every((tab) => Boolean(tab.closest('[data-slot="sidebar"]'))),
  }
})()`)
check(
  'the open session is listed in the sidebar',
  sidebarTabs.count === 1 && sidebarTabs.insideSidebar,
  JSON.stringify(sidebarTabs),
)

await send('Input.insertText', { text: 'echo via-terminal-smoke-ok\r' })
await wait(3000)
const echoed = first ? await evaluate(`window.__buffer(${JSON.stringify(first)})`) : ''
check(
  'typed input round-tripped through the PTY',
  typeof echoed === 'string' && echoed.includes('via-terminal-smoke-ok'),
  String(echoed).slice(-240),
)

await evaluate('window.__clickLabel("Diviser verticalement")')
await wait(3000)
const split = await evaluate(`(() => {
  const store = window.__store()
  return {
    sessions: store.sessions.length,
    surfaces: document.querySelectorAll('.terminal-surface').length,
    separators: document.querySelectorAll('[role="separator"]').length,
  }
})()`)
const preserved = first ? await evaluate(`window.__buffer(${JSON.stringify(first)})`) : ''
check(
  'splitting adds a pane and keeps the original scrollback',
  split.sessions === 2 &&
    split.surfaces === 2 &&
    split.separators === 1 &&
    String(preserved).includes('via-terminal-smoke-ok'),
  JSON.stringify(split),
)

// Switching sessions must not rebuild the renderer.
await evaluate('window.__clickText("Nouvel onglet")')
await wait(300)
await evaluate(`(() => {
  const store = window.__store();
  const profile = store.workspaceProfiles.find((p) => p.id === store.defaultProfileId);
  const button = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes(profile.name));
  if (!button) throw new Error('default local profile is missing from the new-tab picker');
  button.click();
})()`)
await wait(2500)
await evaluate('document.querySelectorAll(\'[role="tab"]\')[0].click()')
await wait(1200)
const afterSwitch = first ? await evaluate(`window.__buffer(${JSON.stringify(first)})`) : ''
check(
  'the scrollback survives a session switch',
  String(afterSwitch).includes('via-terminal-smoke-ok'),
  String(afterSwitch).slice(-200),
)

// The sidebar hides, leaves an 8 px strip, and comes back on hover.
const collapsed = await evaluate(`(() => {
  window.__store().sidebarPinned = false
  return true
})()`)
await wait(400)
const strip = await evaluate(`(() => {
  const el = [...document.querySelectorAll('div')].find((d) => d.className.includes('cursor-e-resize'))
  return el ? Math.round(el.getBoundingClientRect().width) : -1
})()`)
check('hiding the sidebar leaves an 8 px hover strip', collapsed === true && strip === 8, `width=${strip}`)

const peeked = await evaluate(`(() => {
  window.__store().sidebarPeek = true
  return true
})()`)
await wait(400)
const overlay = await evaluate(`(() => {
  const panel = document.querySelector('[data-slot="sidebar"]')
  const main = document.querySelector('main')
  if (!panel || !main) return null
  const panelBox = panel.getBoundingClientRect()
  const mainBox = main.getBoundingClientRect()
  return { panelLeft: Math.round(panelBox.left), mainLeft: Math.round(mainBox.left), panelWidth: Math.round(panelBox.width) }
})()`)
check(
  'a peek floats over the terminal instead of pushing it',
  peeked === true && overlay && overlay.panelLeft === 0 && overlay.mainLeft < overlay.panelWidth,
  JSON.stringify(overlay),
)

await evaluate('window.__store().sidebarPeek = false; window.__store().sidebarPinned = true')
await wait(300)

// Settings is a page, not a dialog.
await evaluate('window.__clickLabel("Réglages")')
await wait(600)
const settings = await evaluate(`(() => {
  const store = window.__store()
  return {
    route: store.route,
    railItems: document.querySelectorAll('[aria-label="Sections des réglages"] button').length,
    hasDialog: Boolean(document.querySelector('[role="dialog"]')),
    hasBreadcrumb: Boolean(document.querySelector('[aria-label="Fil d’Ariane"]')),
  }
})()`)
check(
  'settings opens as a full page with a section rail',
  settings.route === 'settings' &&
    settings.railItems >= 9 &&
    settings.hasBreadcrumb &&
    !settings.hasDialog,
  JSON.stringify(settings),
)

const stillAlive = first ? await evaluate(`window.__buffer(${JSON.stringify(first)})`) : ''
check(
  'sessions survive a visit to the settings page',
  String(stillAlive).includes('via-terminal-smoke-ok'),
  String(stillAlive).slice(-160),
)

await evaluate('window.__store().route = "workspace"')
await wait(400)

// The palette must stay reachable and keyboard driven.
await evaluate('window.__store().paletteOpen = true')
await wait(500)
const palette = await evaluate(`(() => ({
  listbox: Boolean(document.querySelector('[role="listbox"]')),
  options: document.querySelectorAll('[role="option"]').length,
}))()`)
check(
  'the command palette opens as a listbox',
  palette.listbox && palette.options > 0,
  JSON.stringify(palette),
)
await evaluate('window.__store().paletteOpen = false')

const errors = await evaluate('JSON.stringify(window.__smokeErrors ?? [])')
check('no uncaught runtime error', errors === '[]', String(errors))

socket.close()
// process.exit() can truncate piped stdout on Windows.
process.exitCode = failures === 0 ? 0 : 1
