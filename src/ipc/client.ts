import { invoke } from '@tauri-apps/api/core'
import type {
  AppError,
  Bootstrap,
  GroupInput,
  HostInput,
  Id,
  IdentityInput,
  KeyImport,
  Layout,
  Mutation,
  PromptAnswer,
  QuickTarget,
  Settings,
  Size,
  VaultView,
} from './types'

/** The interface also runs in a plain browser under `vite dev`. */
export function isNative(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isNative()) {
    return Promise.reject<T>({
      code: 'native_unavailable',
      message: 'Lancez Via avec « pnpm tauri dev » pour utiliser cette fonction.',
    } satisfies AppError)
  }
  return invoke<T>(command, args)
}

export function errorCode(cause: unknown): string | null {
  return typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : null
}

/** A sentence for the user: Rust messages start in lower case. */
export function describeError(cause: unknown): string {
  const raw =
    typeof cause === 'object' && cause && 'message' in cause
      ? String(cause.message)
      : typeof cause === 'string'
        ? cause
        : 'une erreur inattendue est survenue'
  const sentence = raw.charAt(0).toLocaleUpperCase() + raw.slice(1)
  return /[.!?…]$/.test(sentence) ? sentence : sentence + '.'
}

export const api = {
  bootstrap: () => call<Bootstrap>('app_bootstrap'),
  saveLayout: (layout: Layout) => call<void>('layout_save', { layout }),
  saveSettings: (settings: Settings) => call<Settings>('settings_save', { settings }),

  vault: {
    get: () => call<VaultView>('vault_get'),
    saveHost: (input: HostInput) => call<Mutation>('host_save', { input }),
    deleteHost: (id: Id) => call<Mutation>('host_delete', { id }),
    duplicateHost: (id: Id) => call<Mutation>('host_duplicate', { id }),
    saveGroup: (input: GroupInput) => call<Mutation>('group_save', { input }),
    deleteGroup: (id: Id) => call<Mutation>('group_delete', { id }),
    saveIdentity: (input: IdentityInput) => call<Mutation>('identity_save', { input }),
    deleteIdentity: (id: Id) => call<Mutation>('identity_delete', { id }),
    importKey: (input: KeyImport) => call<Mutation>('key_import', { input }),
    generateKey: (label: string) => call<Mutation>('key_generate', { label }),
    renameKey: (id: Id, label: string) => call<Mutation>('key_rename', { id, label }),
    deleteKey: (id: Id) => call<Mutation>('key_delete', { id }),
    deleteKnownHost: (id: Id) => call<Mutation>('known_host_delete', { id }),
  },

  session: {
    openLocal: (shell: string | null, cwd: string | null, size: Size) =>
      call<Id>('session_open_local', { target: { shell, cwd }, size }),
    openHost: (hostId: Id, size: Size) => call<Id>('session_open_host', { hostId, size }),
    openQuick: (target: QuickTarget, size: Size) =>
      call<Id>('session_open_quick', { target, size }),
    write: (id: Id, data: string) => call<void>('session_write', { id, data }),
    resize: (id: Id, size: Size) => call<void>('session_resize', { id, size }),
    close: (id: Id) => call<void>('session_close', { id }),
    answer: (promptId: Id, answer: PromptAnswer) =>
      call<void>('session_answer', { promptId, answer }),
  },
}
