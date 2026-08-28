import { invoke } from '@tauri-apps/api/core'
import type { AppSnapshot, Workspace } from './types'

const isTauri = () => '__TAURI_INTERNALS__' in window

export const nativeAvailable = isTauri

export async function command<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isTauri())
    throw new Error(`La commande native « ${name} » n'est pas disponible dans le navigateur.`)
  return invoke<T>(name, args)
}

export const nativeApi = {
  snapshot: () => command<AppSnapshot>('app_snapshot'),
  createWorkspace: (name: string) =>
    command<Workspace>('workspace_create', { name, icon: null, color: null }),
  createSession: (workspaceId: string, profileId: string) =>
    command<{ id: string }>('session_spawn', {
      workspaceId,
      profileId,
      cols: 80,
      rows: 24,
    }),
  writeSession: (sessionId: string, data: string) =>
    command<void>('session_write', { id: sessionId, data }),
  resizeSession: (sessionId: string, cols: number, rows: number) =>
    command<void>('session_resize', { id: sessionId, cols, rows }),
  closeSession: (sessionId: string) => command<void>('session_close', { id: sessionId }),
  newWindow: () => command<void>('window_create'),
  lock: () => command<void>('app_lock'),
  isLocked: () => command<boolean>('app_is_locked'),
  unlock: (pin: string) => command<void>('app_unlock', { pin }),
  setupPin: (pin: string) => command<void>('pin_configure', { pin }),
}
