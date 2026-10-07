

import { chromium } from 'playwright-core'
import { homedir } from 'node:os'

const URL = process.env.VIA_URL ?? 'http://localhost:1420/'
const CHROME =
  process.env.CHROME ?? `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto(URL)
await page.waitForFunction(() => window.__via?.spaces.spaces.length > 0)

await page.evaluate(() => {
  const tab = (id) => ({ kind: 'tab', id, title: `Onglet ${id}`, target: { kind: 'local', shell: null, cwd: null } })
  const space = (id, name) => ({
    id,
    name,
    icon: 'terminal',
    defaultShell: null,
    pinned: [1, 2, 3, 4].map((n) => tab(`${id}-p${n}`)),
  })
  const { spaces } = window.__via
  spaces.hydrate({
    activeSpaceId: 'a',
    sidebar: { width: 264, visible: true },
    spaces: [space('a', 'Alpha'), space('b', 'Bravo'), space('c', 'Charlie')],
  })
  for (const s of spaces.spaces) s.temporary = [5, 6, 7].map((n) => tab(`${s.id}-t${n}`))

  window.__switches = []
  let last = spaces.activeId
  spaces.$subscribe(() => {
    if (spaces.activeId !== last) window.__switches.push((last = spaces.activeId))
  })
})
await page.waitForTimeout(300)

const cdp = await page.context().newCDPSession(page)
const box = await page.locator('aside').boundingBox()

const x = Math.round(box.x + box.width / 2)
const y = Math.round(box.y + 130)
await page.mouse.move(x, y)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function wheel(deltaX, deltaY = 0) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY })
}

async function swipe(sign, { fingers = 14, step = 28, inertia = 40, decay = 0.9, settle = 500 } = {}) {
  for (let i = 0; i < fingers; i++) {
    await wheel(sign * step)
    await sleep(16)
  }
  for (let i = 0; i < inertia; i++) {
    const d = step * Math.pow(decay, i + 1)
    if (d < 0.5) break
    await wheel(sign * d)
    await sleep(16)
  }
  await sleep(settle)
}

const state = () => page.evaluate(() => ({ active: window.__via.spaces.activeId, switches: [...window.__switches] }))
const order = ['a', 'b', 'c']
const next = (id, d) => order[(order.indexOf(id) + d + order.length) % order.length]
const results = []
const report = (ok, line) => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`)
}

async function check(name, run, moves) {
  const before = await state()
  let at = before.active
  const expected = moves.map((d) => (at = next(at, d)))
  await run()
  const fired = (await state()).switches.slice(before.switches.length)
  const ok = JSON.stringify(fired) === JSON.stringify(expected)
  report(ok, `${name}: switches ${JSON.stringify(fired)}, expected ${JSON.stringify(expected)}`)
}

await check('swipe to the next space', () => swipe(1), [1])
await check('second swipe, same direction, no click', () => swipe(1), [1])
await check('swipe back, opposite direction, no click', () => swipe(-1), [-1])
await check('swipe back again', () => swipe(-1), [-1])
for (let i = 0; i < 5; i++) {
  const d = i % 2 ? -1 : 1
  await check(`alternating gesture ${i + 1}/5`, () => swipe(d), [d])
}
for (let i = 0; i < 5; i++) {
  await check(`consecutive gesture ${i + 1}/5`, () => swipe(1), [1])
}

for (let i = 0; i < 4; i++) {
  const d = i % 2 ? -1 : 1
  await check(`swipe while the last one's inertia still runs ${i + 1}/4`, () => swipe(d, { inertia: 25, decay: 0.96, settle: 0 }), [d])
}
for (let i = 0; i < 3; i++) {
  await check(`same-direction swipe during inertia ${i + 1}/3`, () => swipe(1, { inertia: 25, decay: 0.96, settle: 0 }), [1])
}
await sleep(500)
await check('short swipe springs back without switching', () => swipe(1, { fingers: 4, step: 8, inertia: 0 }), [])
await check('long swipe with a long inertia tail switches once', () => swipe(-1, { fingers: 30, step: 30, inertia: 120, decay: 0.97 }), [-1])
await check('quick flick switches', () => swipe(1, { fingers: 3, step: 25, inertia: 30 }), [1])
await check('vertical scroll never switches', async () => {
  for (let i = 0; i < 10; i++) {
    await wheel(0, 30)
    await sleep(16)
  }
  await sleep(400)
}, [])

await check('ctrl+wheel switches one space per notch', async () => {
  for (let i = 0; i < 2; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: 100, modifiers: 2 })
    await sleep(400)
  }
}, [1, 1])

const panels = () =>
  page.evaluate(() => {
    const track = document.querySelector('[data-space-track]')
    if (!track) return null
    const left = track.getBoundingClientRect().left
    return Object.fromEntries(
      [...track.querySelectorAll('[data-space-panel]')]
        .filter((p) => getComputedStyle(p).visibility !== 'hidden')
        .map((p) => [p.dataset.spacePanel, Math.round(p.getBoundingClientRect().left - left)]),
    )
  })
const under = await page.evaluateHandle(([px, py]) => document.elementFromPoint(px, py), [x, y])
const from = (await state()).active
for (let i = 0; i < 4; i++) {
  await wheel(10)
  await sleep(16)
}
const mid = await panels()
const width = Math.round(box.width)
report(
  mid?.[from] === -40 && mid?.[next(from, 1)] === width - 40,
  `the spaces follow the fingers: after 40px the panels stand at ${JSON.stringify(mid)}, expected ${from}: -40, ${next(from, 1)}: ${width - 40}`,
)
await sleep(120)
const springing = await panels()
await sleep(400)
const rest = await panels()
report(
  springing?.[from] < 0 && springing?.[from] > -40 && JSON.stringify(rest) === JSON.stringify({ [from]: 0 }),
  `a released short drag springs back (mid-way ${JSON.stringify(springing)}, settled ${JSON.stringify(rest)})`,
)
const swiping = swipe(1, { settle: 0 })
await sleep(360)
const sliding = await panels()
await swiping
await sleep(500)
const switched = (await state()).active
report(
  Object.keys(sliding ?? {}).length === 2 && JSON.stringify(await panels()) === JSON.stringify({ [switched]: 0 }),
  `a committed swipe slides home (mid-way ${JSON.stringify(sliding)}, settled on ${switched})`,
)
report(await under.evaluate((node) => node.isConnected), 'the node under the pointer is still in the document after a switch')

const target = next(switched, -1)
await page.locator(`nav[aria-label="Espaces"] button[aria-label="${{ a: 'Alpha', b: 'Bravo', c: 'Charlie' }[target]}"]`).click()
await sleep(60)
const clicked = await panels()
await sleep(500)
report(
  clicked?.[target] !== undefined && clicked[target] !== 0 && JSON.stringify(await panels()) === JSON.stringify({ [target]: 0 }),
  `a click in the switcher slides to the space (mid-way ${JSON.stringify(clicked)})`,
)
await page.mouse.move(x, y)

const hidden = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('[data-space-panel]')]
  const inactive = panels.filter((p) => p.dataset.spacePanel !== window.__via.spaces.activeId)
  return panels.length >= 2 && inactive.every((p) => p.inert && p.getAttribute('aria-hidden') === 'true')
})
report(hidden, 'inactive panels are inert and hidden from assistive tech')

await page.emulateMedia({ reducedMotion: 'reduce' })
await sleep(100)
for (let i = 0; i < 4; i++) {
  await wheel(20)
  await sleep(16)
}
const still = await panels()
await sleep(400)
report(Object.values(still ?? { x: 1 }).every((left) => left === 0) && Object.keys(still).length === 1, `reduced motion: nothing follows the fingers (${JSON.stringify(still)})`)
await check('reduced motion: a swipe still switches', () => swipe(-1), [-1])
await page.emulateMedia({ reducedMotion: 'no-preference' })

if (errors.length) console.log('page errors:', errors)

await browser.close()
const failed = results.filter((ok) => !ok).length
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
