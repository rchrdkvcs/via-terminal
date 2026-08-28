import type { ITheme } from '@xterm/xterm'

/**
 * xterm paints on a canvas, so it cannot read CSS custom properties. The two
 * palettes below mirror the surface tokens in `styles.css`; the ANSI colours
 * are shared because they must stay legible on both surfaces.
 */
const ansi = {
  black: '#3b3b45',
  red: '#f2707f',
  green: '#5fd58a',
  yellow: '#e5b567',
  blue: '#7aa5ef',
  magenta: '#c48ff0',
  cyan: '#5fc6d4',
  white: '#c8c8d2',
  brightBlack: '#5c5c69',
  brightRed: '#ff8b98',
  brightGreen: '#7ce5a5',
  brightYellow: '#f2ca7d',
  brightBlue: '#9bbcf7',
  brightMagenta: '#d6a9f7',
  brightCyan: '#7fdcea',
  brightWhite: '#f2f2f7',
}

const darkTheme: ITheme = {
  ...ansi,
  background: '#141419',
  foreground: '#e8e8ee',
  cursor: '#c4a7fb',
  cursorAccent: '#141419',
  selectionBackground: '#7c5ce755',
  selectionForeground: '#ffffff',
}

const lightTheme: ITheme = {
  ...ansi,
  black: '#2b2b33',
  red: '#c03a4c',
  green: '#237a48',
  yellow: '#8a6300',
  blue: '#2c5bb8',
  magenta: '#7a3fb0',
  cyan: '#0f6d7c',
  white: '#5c5c69',
  background: '#ffffff',
  foreground: '#2a2a33',
  cursor: '#6b4fd8',
  cursorAccent: '#ffffff',
  selectionBackground: '#6b4fd833',
  selectionForeground: '#161620',
}

export function terminalTheme(appearance: 'dark' | 'light'): ITheme {
  return appearance === 'light' ? lightTheme : darkTheme
}
