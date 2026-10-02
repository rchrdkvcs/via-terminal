/**
 * Smoke check of the real application over CDP: local shell round trip,
 * command bar, pin, split, and restoration after a reload. It works in a
 * throwaway space so the user's own spaces are never touched.
 */
import { connect } from './cdp.mjs'

const app = await connect()
const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail })
const text = (selector) => app.evaluate(`document.querySelector('${selector}')?.innerText ?? ''`)
const buffer = () =>
  app.evaluate(`(() => { const e = [...window.__viaTerminals.entries.values()].at(-1); if (!e) return '';
    const b = e.terminal.buffer.active; const out = [];
    for (let i = 0; i < b.length; i++) { const l = b.getLine(i)?.translateToString(true); if (l) out.push(l) }
    return out.join(String.fromCharCode(10)) })()`)

await app.evaluate('location.reload()')
await app.wait(4000)
check('the window boots', (await text('aside')).includes('Nouvel onglet'))
await app.evaluate(`window.__via.spaces.create({ name: 'Smoke', icon: 'flask-conical', defaultShell: null }).id`)
const smoke = () => `window.__via.spaces.spaces.find((s) => s.name === 'Smoke')`

await app.press('Ctrl+Shift+T')
await app.type('powershell')
check('the command bar finds shells', (await text('[role=listbox]')).includes('PowerShell'))
await app.press('Enter')
await app.wait(2500)
await app.evaluate(`[...window.__viaTerminals.entries.values()].at(-1).terminal.input('echo via-smoke' + String.fromCharCode(13))`)
await app.wait(1500)
check('typed input reaches the shell', (await buffer()).split('via-smoke').length > 2)

await app.press('Ctrl+Shift+D')
await app.press('Alt+Shift+D')
await app.type('invite')
await app.press('Enter')
await app.wait(2000)
const splitRows = await app.evaluate(`document.querySelectorAll('[role=group][aria-label^="Vue partagée"]').length`)
check('a split view is one sidebar row', splitRows >= 1, `${splitRows}`)

const saved = await app.evaluate(
  `window.__TAURI_INTERNALS__.invoke('app_bootstrap').then((b) => b.layout.spaces.find((s) => s.name === 'Smoke').pinned.length)`,
)
check('the pinned rows are saved', saved >= 1, `${saved} pinned`)
await app.evaluate('location.reload()')
await app.wait(4000)
await app.evaluate(`window.__via.spaces.activate(${smoke()}.id)`)
await app.wait(500)
const asleep = await app.evaluate(`document.querySelectorAll('[aria-label="en veille"]').length`)
check('pinned tabs come back asleep', asleep >= 2, `${asleep} asleep`)
await app.evaluate(`(() => { const v = window.__via; const s = ${smoke()};
  for (const r of s.pinned) for (const t of r.kind === 'split' ? r.tabs : [r]) v.sessions.release(t.id)
  v.spaces.remove(s.id) })()`)
check('no runtime errors', app.errors.length === 0, app.errors.join(' | '))

for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name} ${result.detail}`)
app.close()
process.exit(results.every((result) => result.ok) ? 0 : 1)
