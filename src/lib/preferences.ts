import type { Density, ThemePreference } from '@/ipc/types'

/**
 * Presentation choices the Rust `Settings` record does not carry. Keeping them
 * out of the snapshot avoids sending fields `settings_update` would reject, and
 * they are per-machine anyway.
 */
export interface LocalPreferences {
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  screenReaderMode: boolean
  /** Milliseconds the pointer must rest on the edge before the sidebar returns. */
  sidebarRevealDelay: number
  /** Milliseconds after the pointer leaves before a peeked sidebar hides. */
  sidebarHideDelay: number
  /** Lines xterm keeps per session. */
  scrollback: number
  /** Ask before closing a tab that still owns a live session. */
  confirmOnClose: boolean
  systemPrefersDark: boolean
  /** Sidebar width in pixels; shared between the pinned panel and the peek overlay. */
  sidebarWidth: number
}

const STORAGE_KEY = 'terminarr.preferences'

const fallback: LocalPreferences = {
  cursorStyle: 'bar',
  cursorBlink: true,
  screenReaderMode: false,
  sidebarRevealDelay: 50,
  sidebarHideDelay: 300,
  scrollback: 10000,
  confirmOnClose: true,
  systemPrefersDark: true,
  sidebarWidth: 256,
}

export function loadPreferences(): LocalPreferences {
  const systemPrefersDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...fallback, systemPrefersDark }
    return { ...fallback, ...(JSON.parse(raw) as Partial<LocalPreferences>), systemPrefersDark }
  } catch {
    return { ...fallback, systemPrefersDark }
  }
}

export function savePreferences(value: LocalPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Private mode or a storage quota; preferences simply do not persist.
  }
}

export const themeLabels: Record<ThemePreference, string> = {
  dark: 'Sombre',
  light: 'Clair',
  system: 'Système',
}

export const densityLabels: Record<Density, string> = {
  comfortable: 'Confortable',
  compact: 'Compacte',
}
