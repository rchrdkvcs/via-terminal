import type { ITheme } from '@xterm/xterm'
import { oklchToHex } from '@/lib/oklch'

export interface Presentation {
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  scrollback: number
  appearance: 'dark' | 'light'
  /** Hue of the active space; the terminal surface carries a trace of it. */
  hue: number
}

/** The ANSI ramp belongs to the shell's output, so it stays in full color. */
const ansiDark = {
  black: '#3b4048',
  red: '#f07178',
  green: '#a6d189',
  yellow: '#e5c07b',
  blue: '#82aaff',
  magenta: '#c792ea',
  cyan: '#89ddff',
  white: '#d0d4dc',
  brightBlack: '#6b7280',
  brightRed: '#ff8b92',
  brightGreen: '#bde3a2',
  brightYellow: '#f2d49b',
  brightBlue: '#a3c0ff',
  brightMagenta: '#dab1f5',
  brightCyan: '#a8e8ff',
  brightWhite: '#f5f7fa',
}

const ansiLight = {
  black: '#2b2f36',
  red: '#c0392b',
  green: '#2f7d32',
  yellow: '#8a6500',
  blue: '#1f5fbf',
  magenta: '#8a3ab9',
  cyan: '#0b7285',
  white: '#6b7280',
  brightBlack: '#4b5563',
  brightRed: '#d64535',
  brightGreen: '#38913c',
  brightYellow: '#9c7400',
  brightBlue: '#2a6fd6',
  brightMagenta: '#9b4bcc',
  brightCyan: '#0f8299',
  brightWhite: '#111318',
}

/** Must match `--surface` and `--surface-ink` in `styles/tokens.css`. */
export function terminalTheme({ appearance, hue }: Presentation): ITheme {
  if (appearance === 'light') {
    const background = oklchToHex(0.995, 0.003, hue)
    return {
      ...ansiLight,
      background,
      foreground: oklchToHex(0.24, 0.012, hue),
      cursor: oklchToHex(0.45, 0.08, hue),
      cursorAccent: background,
      selectionBackground: oklchToHex(0.88, 0.04, hue),
    }
  }
  const background = oklchToHex(0.185, 0.012, hue)
  return {
    ...ansiDark,
    background,
    foreground: oklchToHex(0.93, 0.008, hue),
    cursor: oklchToHex(0.8, 0.09, hue),
    cursorAccent: background,
    selectionBackground: oklchToHex(0.36, 0.04, hue),
  }
}
