import type { ITheme } from '@xterm/xterm'

export interface Presentation {
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  scrollback: number
  appearance: 'dark' | 'light'
}

/** The ANSI ramp belongs to the shell's output, so it stays in full color. */
const ansiDark = {
  black: '#3a3a3c',
  red: '#ff6b6b',
  green: '#7ee787',
  yellow: '#f2cc60',
  blue: '#79b8ff',
  magenta: '#d2a8ff',
  cyan: '#76e3ea',
  white: '#d1d1d6',
  brightBlack: '#6e6e73',
  brightRed: '#ff8f8f',
  brightGreen: '#a2f0aa',
  brightYellow: '#f8dd8a',
  brightBlue: '#a5d0ff',
  brightMagenta: '#e2c5ff',
  brightCyan: '#a3f0f4',
  brightWhite: '#f5f5f7',
}

const ansiLight = {
  black: '#1d1d1f',
  red: '#c9302c',
  green: '#1f7a37',
  yellow: '#8a6100',
  blue: '#1a5fd0',
  magenta: '#8a3fc2',
  cyan: '#0a7285',
  white: '#6e6e73',
  brightBlack: '#48484a',
  brightRed: '#dd3c37',
  brightGreen: '#25903f',
  brightYellow: '#9f7000',
  brightBlue: '#2470e0',
  brightMagenta: '#9c4fd4',
  brightCyan: '#0e8399',
  brightWhite: '#000000',
}

/** Must match `--surface` and `--surface-ink` in `styles/tokens.css`. */
export function terminalTheme({ appearance }: Presentation): ITheme {
  if (appearance === 'light') {
    return {
      ...ansiLight,
      background: '#ffffff',
      foreground: '#1d1d1f',
      cursor: '#1d1d1f',
      cursorAccent: '#ffffff',
      selectionBackground: '#0000001f',
    }
  }
  return {
    ...ansiDark,
    background: '#141415',
    foreground: '#ececee',
    cursor: '#ececee',
    cursorAccent: '#141415',
    selectionBackground: '#ffffff2e',
  }
}
