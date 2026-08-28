/**
 * End-to-end smoke check against the running Tauri window over CDP.
 *
 * Start the app with:
 *   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 pnpm tauri dev
 *
 * The WebGL renderer paints to a canvas, so terminal contents are read through
 * the dev-only `window.__terminarr` handle rather than the DOM.
 */
const PORT = process.env.CDP_PORT ?? '9333'

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:1420'))
if (!page) throw new Error(`no Terminarr page target: ${JSON.stringify(targets.map((t) => t.url))}`)

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

await evaluate(`window.__smokeErrors = window.__smokeErrors ?? [];
  window.addEventListener('error', (e) => window.__smokeErrors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => window.__smokeErrors.push(String(e.reason)));`)

const boot = await evaluate(`(() => ({
  title: document.title,
  workspace: document.querySelector('aside p.font-semibold')?.textContent?.trim() ?? null,
  hasRegistry: Boolean(window.__terminarr),
  treeRows: document.querySelectorAll('aside nav button').length,
}))()`)
check(
  'window boots with the persisted workspace and the terminal registry',
  boot.workspace && boot.workspace !== 'Aucun' && boot.hasRegistry,
  JSON.stringify(boot),
)

await evaluate(`document.querySelector('main button[aria-label="Nouveau terminal"]').click()`)
await wait(3000)

const sessionId = await evaluate(`(() => {
  const el = document.querySelector('.terminal-surface canvas, .terminal-surface .xterm-rows')
  return el ? 'rendered' : 'missing'
})()`)
check('a renderer is attached to the pane', sessionId === 'rendered', String(sessionId))

const prompt = await evaluate(`(() => {
  const { terminals } = window.__terminarr
  const ids = [...(terminals.entries ?? new Map()).keys?.() ?? []]
  return JSON.stringify({ ids })
})()`)

// The registry keeps `entries` private, so drive it through the pane instead.
const readActive = `(() => {
  const app = document.querySelector('#app').__vue_app__
  const store = app.config.globalProperties.$pinia.state.value.app
  const ids = store.sessions.map((s) => s.id)
  return ids
})()`
const ids = await evaluate(readActive)
check('the store registered exactly one session', Array.isArray(ids) && ids.length === 1, JSON.stringify(ids))

const first = Array.isArray(ids) ? ids[0] : null
const banner = first ? await evaluate(`window.__terminarr.terminals.readBuffer(${JSON.stringify(first)}).trim()`) : ''
check('the PTY streamed a shell prompt', typeof banner === 'string' && banner.length > 0, String(banner).slice(0, 200))

await send('Input.insertText', { text: 'echo terminarr-smoke-ok\r' })
await wait(3000)
const echoed = first ? await evaluate(`window.__terminarr.terminals.readBuffer(${JSON.stringify(first)})`) : ''
check(
  'typed input round-tripped through the PTY',
  typeof echoed === 'string' && echoed.includes('terminarr-smoke-ok'),
  String(echoed).slice(-240),
)

await evaluate(`document.querySelector('main button[aria-label="Diviser verticalement"]').click()`)
await wait(3000)
const split = await evaluate(`(() => {
  const app = document.querySelector('#app').__vue_app__
  const store = app.config.globalProperties.$pinia.state.value.app
  return {
    sessions: store.sessions.length,
    surfaces: document.querySelectorAll('.terminal-surface').length,
    separators: document.querySelectorAll('[role="separator"]').length,
  }
})()`)
const preserved = first ? await evaluate(`window.__terminarr.terminals.readBuffer(${JSON.stringify(first)})`) : ''
check(
  'splitting adds a pane and keeps the original scrollback',
  split.sessions === 2 &&
    split.surfaces === 2 &&
    split.separators === 1 &&
    String(preserved).includes('terminarr-smoke-ok'),
  JSON.stringify(split),
)

// Switching tabs must not rebuild the renderer.
await evaluate(`document.querySelector('main button[aria-label="Nouveau terminal"]').click()`)
await wait(2500)
await evaluate(`document.querySelectorAll('[role="tab"]')[0].click()`)
await wait(1200)
const afterSwitch = first ? await evaluate(`window.__terminarr.terminals.readBuffer(${JSON.stringify(first)})`) : ''
check(
  'the scrollback survives a tab switch',
  String(afterSwitch).includes('terminarr-smoke-ok'),
  String(afterSwitch).slice(-200),
)

const errors = await evaluate('JSON.stringify(window.__smokeErrors ?? [])')
check('no uncaught runtime error', errors === '[]', String(errors))

void prompt
socket.close()
// process.exit() can truncate piped stdout on Windows.
process.exitCode = failures === 0 ? 0 : 1
