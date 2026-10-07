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

  systemShell: string | null
  platform: 'windows' | 'macos' | 'linux' | string
}

export interface TrackpadSwipeEvent {
  phase: 'start' | 'update' | 'end' | 'cancel'
  dx: number
  dy: number

  t: number
}

export interface SwipeRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface AppError {
  code: string
  message: string
}
