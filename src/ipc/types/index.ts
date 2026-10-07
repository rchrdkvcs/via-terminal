export type * from './layout'
export type * from './session'
export type * from './vault'

import type { Layout } from './layout'
import type { Settings, Shell } from './session'
import type { VaultView } from './vault'

export interface Bootstrap {
  layout: Layout
  settings: Settings
  vault: VaultView
  shells: Shell[]
  /** The shell used when neither the tab, its space nor settings name one. */
  systemShell: string | null
  platform: 'windows' | 'macos' | 'linux' | string
}

/**
 * One step of a touchpad swipe over the sidebar, phased by the OS (macOS).
 * `dx` is in px; positive is the fingers moving left, revealing the next space.
 */
export interface TrackpadSwipeEvent {
  phase: 'start' | 'update' | 'end' | 'cancel'
  dx: number
  dy: number
  /** Event time in ms. */
  t: number
}

/** The sidebar in window coordinates, where touchpad swipes may start. */
export interface SwipeRegion {
  x: number
  y: number
  width: number
  height: number
}

/** Every command rejects with this shape. */
export interface AppError {
  code: string
  message: string
}
