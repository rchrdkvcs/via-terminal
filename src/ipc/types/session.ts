import type { Id } from './layout'

export interface Size {
  cols: number
  rows: number
}

export type SessionState =
  | 'connecting'
  | 'verifying'
  | 'authenticating'
  | 'ready'
  | 'exited'
  | 'failed'
  | 'disconnected'

export interface PromptField {
  label: string
  echo: boolean
}

export type Prompt =
  | {
      kind: 'hostKey'
      address: string
      port: number
      algorithm: string
      fingerprint: string
      previousFingerprint: string | null
    }
  | { kind: 'username'; address: string }
  | { kind: 'password'; username: string; address: string; canRemember: boolean; retry: boolean }
  | { kind: 'passphrase'; keyLabel: string; canRemember: boolean; retry: boolean }
  | { kind: 'keyboardInteractive'; name: string; instructions: string; fields: PromptField[] }

export type PromptAnswer =
  | { kind: 'accept' }
  | { kind: 'cancel' }
  | { kind: 'text'; value: string; remember: boolean }
  | { kind: 'fields'; values: string[] }

export interface QuickTarget {
  address: string
  port: number | null
  username: string | null
}

export interface Shell {
  path: string
  name: string
  args: string[]
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  scrollback: number
  copyOnSelect: boolean
  defaultShell: string | null
  saveQuickConnect: boolean
  confirmCloseRunning: boolean
}

export interface TerminalOutputEvent {
  sessionId: Id
  dataBase64: string
}

export interface SessionStateEvent {
  sessionId: Id
  state: SessionState
  message: string | null
  exitCode: number | null
}

export interface SessionPromptEvent {
  sessionId: Id
  promptId: Id
  prompt: Prompt | null
}

export interface VaultChangedEvent {
  sessionId: Id
  hostId: Id | null
}
