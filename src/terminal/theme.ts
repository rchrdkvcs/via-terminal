import type { ITheme } from '@xterm/xterm'

/**
 * xterm paints on a canvas, so it cannot read CSS custom properties. The
 * surfaces below mirror the neutral surface tokens in `styles.css`
 * (`--background` and `--foreground`) expressed in sRGB.
 *
 * The ANSI ramp stays in colour on purpose: it belongs to the shell's output,
 * not to the application chrome.
 */
const ansiDark = {
  black: '#404040',
  red: '#f2707f',
  green: '#5fd58a',
  yellow: '#e5b567',
  blue: '#7aa5ef',
  magenta: '#c48ff0',
  cyan: '#5fc6d4',
  white: '#d4d4d4',
  brightBlack: '#737373',
  brightRed: '#ff8b98',
  brightGreen: '#7ce5a5',
  brightYellow: '#f2ca7d',
  brightBlue: '#9bbcf7',
  brightMagenta: '#d6a9f7',
  brightCyan: '#7fdcea',
  brightWhite: '#fafafa',
}

const ansiLight = {
  black: '#262626',
  red: '#c03a4c',
  green: '#237a48',
  yellow: '#8a6300',
  blue: '#2c5bb8',
  magenta: '#7a3fb0',
  cyan: '#0f6d7c',
  white: '#737373',
  brightBlack: '#525252',
  brightRed: '#d4485a',
  brightGreen: '#2b8f55',
  brightYellow: '#9c7100',
  brightBlue: '#356ad0',
  brightMagenta: '#8c4cc7',
  brightCyan: '#137e90',
  brightWhite: '#171717',
}

/** neutral-950 elevated terminal surface, neutral-100 text. */
const darkTheme: ITheme = {
  ...ansiDark,
  background: '#0a0a0a',
  foreground: '#f5f5f5',
  cursor: '#a3a3a3',
  cursorAccent: '#0a0a0a',
  selectionBackground: '#ffffff2e',
  selectionForeground: '#ffffff',
}

const lightTheme: ITheme = {
  ...ansiLight,
  background: '#ffffff',
  foreground: '#171717',
  cursor: '#525252',
  cursorAccent: '#ffffff',
  selectionBackground: '#0a0a0a24',
  selectionForeground: '#0a0a0a',
}

export function terminalTheme(appearance: 'dark' | 'light'): ITheme {
  return appearance === 'light' ? lightTheme : darkTheme
}
