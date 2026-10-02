/**
 * Minimal CDP client for the running Via window (see lessons.md).
 * Start the app with:
 *   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 pnpm tauri dev
 */
const PORT = process.env.CDP_PORT ?? '9333'
const CODES = { Enter: [13, 'Enter'], Escape: [27, 'Escape'], Tab: [9, 'Tab'], ArrowDown: [40, 'ArrowDown'], ArrowUp: [38, 'ArrowUp'] }

export async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:1420'))
  if (!page) throw new Error('no Via window found')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))
  let id = 0
  const pending = new Map()
  const errors = []
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description)
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  })
  const send = (method, params) =>
    new Promise((resolve) => {
      const current = ++id
      pending.set(current, resolve)
      socket.send(JSON.stringify({ id: current, method, params }))
    })
  await send('Runtime.enable')
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  return {
    errors,
    wait,
    close: () => socket.close(),
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.exception?.description)
      return result.result?.result?.value
    },
    /** A real key press, e.g. `Ctrl+Shift+T`, so capture-phase shortcuts are exercised. */
    async press(combo) {
      const parts = combo.split('+')
      const key = parts.pop()
      const modifiers = (parts.includes('Alt') ? 1 : 0) | (parts.includes('Ctrl') ? 2 : 0) | (parts.includes('Meta') ? 4 : 0) | (parts.includes('Shift') ? 8 : 0)
      const [vk, name] = CODES[key] ?? [key.toUpperCase().charCodeAt(0), key]
      const code = CODES[key] ? name : /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`
      for (const type of ['rawKeyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', { type, modifiers, windowsVirtualKeyCode: vk, code, key: name })
      }
      await wait(150)
    },
    async type(text) {
      await send('Input.insertText', { text })
      await wait(150)
    },
    async screenshot(path) {
      const { result } = await send('Page.captureScreenshot', { format: 'png' })
      const fs = await import('node:fs')
      fs.writeFileSync(path, Buffer.from(result.data, 'base64'))
    },
  }
}
