import { invoke } from '@tauri-apps/api/core'

const isTauri = () => '__TAURI_INTERNALS__' in window

export const nativeAvailable = isTauri

export async function command<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isTauri())
    throw new Error(`La commande native « ${name} » n'est pas disponible dans le navigateur.`)
  return invoke<T>(name, args)
}

export const nativeApi = {
  workspaces: () => command<unknown[]>('workspace_list'),
  createWorkspace: (name: string) => command('workspace_create', { name }),
  createSession: (executable = 'powershell.exe', args: string[] = []) =>
    command<{ id: string }>('session_spawn', {
      executable,
      args,
      workingDirectory: null,
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
}
