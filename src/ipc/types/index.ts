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

/** Every command rejects with this shape. */
export interface AppError {
  code: string
  message: string
}
