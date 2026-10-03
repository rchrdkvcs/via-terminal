import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInstance, type Instance } from './create'

vi.mock('./create', () => ({ createInstance: vi.fn(), applyPresentation: vi.fn() }))

function fakeInstance() {
  const terminal = {
    cols: 100,
    rows: 30,
    focus: vi.fn(),
    paste: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    getSelection: vi.fn(() => 'selected text'),
    onData: vi.fn(),
    onResize: vi.fn(),
    onTitleChange: vi.fn(),
    onSelectionChange: vi.fn(),
    parser: { registerOscHandler: vi.fn() },
  }
  terminal.resize.mockImplementation((cols: number, rows: number) => {
    terminal.cols = cols
    terminal.rows = rows
  })
  const search = {
    findNext: vi.fn(() => true),
    findPrevious: vi.fn(() => false),
    clearDecorations: vi.fn(),
  }
  const fit = { proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })) }
  const container = document.createElement('div')
  const dispose = vi.fn(() => container.remove())
  return { terminal, search, fit, container, dispose }
}

let terminals: typeof import('./registry').terminals
let instance: ReturnType<typeof fakeInstance>
let frames: Map<number, FrameRequestCallback>
let frameId: number

function renderFrame() {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(0))
}

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  frames = new Map()
  frameId = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  instance = fakeInstance()
  vi.mocked(createInstance).mockReturnValue(instance as unknown as Instance)
  terminals = (await import('./registry')).terminals
})

describe('terminal registry interface', () => {
  it('searches both ways and clears decorations without exposing xterm', () => {
    terminals.attach('a', document.createElement('div'))
    expect(terminals.search('a', 'query', 1)).toBe(true)
    expect(terminals.search('a', 'query', -1)).toBe(false)
    expect(instance.search.findNext).toHaveBeenCalledWith('query', {
      incremental: true,
      caseSensitive: false,
    })
    expect(instance.search.findPrevious).toHaveBeenCalledWith('query', {
      incremental: false,
      caseSensitive: false,
    })
    terminals.clearSearch('a')
    expect(instance.search.clearDecorations).toHaveBeenCalledOnce()
    expect('get' in terminals).toBe(false)
  })

  it('reads selection and uses xterm paste so bracketed paste stays intact', () => {
    terminals.attach('a', document.createElement('div'))
    expect(terminals.selection('a')).toBe('selected text')
    terminals.paste('a', 'first\nsecond')
    expect(instance.terminal.paste).toHaveBeenCalledWith('first\nsecond')
    terminals.focus('a')
    expect(instance.terminal.focus).toHaveBeenCalledOnce()
  })

  it('does not create terminals for missing tabs or empty searches', () => {
    expect(terminals.search('missing', 'query')).toBe(false)
    expect(terminals.selection('missing')).toBe('')
    terminals.paste('missing', 'text')
    terminals.clearSearch('missing')
    terminals.focus('missing')
    expect(createInstance).not.toHaveBeenCalled()
    terminals.attach('a', document.createElement('div'))
    expect(terminals.search('a', '')).toBe(false)
    expect(instance.search.findNext).not.toHaveBeenCalled()
  })

  it('moves one renderer and preserves queued output across detach and attach', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    terminals.attach('a', first)
    terminals.feed('a', new Uint8Array([1, 2]))
    terminals.detach('a')
    terminals.attach('a', second)
    terminals.feed('a', new Uint8Array([3]))
    renderFrame()
    expect(createInstance).toHaveBeenCalledOnce()
    expect(instance.container.parentElement).toBe(second)
    expect(instance.terminal.write).toHaveBeenCalledExactlyOnceWith(new Uint8Array([1, 2, 3]))
  })

  it('measures attached tabs through the same interface used to open sessions', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    terminals.attach('a', host)
    expect(await terminals.measure('a')).toEqual({ cols: 80, rows: 24 })
    expect(instance.terminal.resize).toHaveBeenCalledWith(80, 24)
    host.remove()
  })

  it('disposes released tabs and ignores pending output and interactions', () => {
    terminals.feed('a', new Uint8Array([1]))
    terminals.release('a')
    renderFrame()
    terminals.paste('a', 'late')
    expect(instance.dispose).toHaveBeenCalledOnce()
    expect(instance.terminal.write).not.toHaveBeenCalled()
    expect(instance.terminal.paste).not.toHaveBeenCalled()
  })
})
