import { invoke } from '@tauri-apps/api/core'
import { isNative } from './client'

/** Endpoint and account behind a listing, document or transfer. Compare with `===` only. */
export type RemoteOwner = string
export type EntryKind = 'file' | 'directory' | 'link' | 'other'
export interface RemoteEntry {
  name: string
  path: string
  kind: EntryKind
  targetKind: EntryKind | null
  size: number
  modified: number | null
  permissions: number | null
}
export interface RemoteText {
  owner: RemoteOwner
  path: string
  resolvedPath: string
  content: string
  permissions: number | null
  uid: number | null
  gid: number | null
}
export interface Listing {
  owner: RemoteOwner
  path: string
  entries: RemoteEntry[]
}
export type Collision = 'replace' | 'skip' | 'keepBoth'
export type TransferDirection = 'upload' | 'download'
export interface TransferPlan {
  id: string
  owner: RemoteOwner
  direction: TransferDirection
  sources: string[]
  destination: string
  completedSources?: string[]
  directories?: Record<string, string>
}
export type FileRequest =
  | { operation: 'list'; path: string }
  | { operation: 'read'; path: string }
  | { operation: 'save'; document: RemoteText; original: string; overwrite: boolean }
  | { operation: 'create'; parent: string; name: string; directory: boolean }
  | { operation: 'move'; path: string; destination: string }
  | { operation: 'delete'; path: string }
  | { operation: 'chmod'; path: string; permissions: number }
  | ({ operation: 'transfer' } & TransferPlan)
  | { operation: 'cancel'; id: string }
  | { operation: 'resolve'; id: string; choice: Collision; all: boolean }
interface FileReplies {
  list: Listing
  read: RemoteText
  save: RemoteText
  create: null
  move: null
  delete: null
  chmod: null
  transfer: null
  cancel: null
  resolve: null
}
export type FileReply<R extends FileRequest> = FileReplies[R['operation']]
export type NativeTransferState = 'running' | 'conflict' | 'completed' | 'failed' | 'cancelled'
export interface TransferEvent {
  sessionId: string
  id: string
  direction: TransferDirection
  state: NativeTransferState
  path: string
  bytes: number
  total: number
  message: string | null
  skipped: string[]
  completedSources: string[]
  directories: Record<string, string>
}
export const filesApi = {
  request: <R extends FileRequest>(sessionId: string, request: R): Promise<FileReply<R>> => {
    if (!isNative())
      return Promise.reject({
        code: 'native_unavailable',
        message: 'SFTP nécessite Via en mode natif.',
      })
    return invoke<FileReply<R>>('session_files', { id: sessionId, request })
  },
  pick: (directory: boolean, download = false) =>
    invoke<string[]>('files_pick', { directory, download }),
  stageBegin: () => invoke<string>('files_stage_begin'),
  stageDirectory: (id: string, path: string) => invoke<void>('files_stage_directory', { id, path }),
  stageChunk: (id: string, path: string, data: number[]) =>
    invoke<void>('files_stage_chunk', { id, path, data }),
  stageFinish: (id: string) => invoke<string[]>('files_stage_finish', { id }),
  stageDiscard: (id: string) => invoke<void>('files_stage_discard', { id }),
}
