import { invoke } from '@tauri-apps/api/core'
import { isNative } from './client'

export interface RemoteEntry {
  name: string
  path: string
  kind: 'file' | 'directory' | 'link' | 'other'
  targetKind?: 'file' | 'directory' | null
  size: number
  modified: number | null
  permissions: number | null
}
export interface RemoteText {
  owner?: string
  path: string
  resolvedPath: string
  content: string
  permissions: number | null
  uid: number | null
  gid: number | null
}
export interface Listing {
  owner?: string
  path: string
  entries: RemoteEntry[]
}
export type FileRequest =
  | { operation: 'list'; path: string }
  | { operation: 'read'; path: string }
  | { operation: 'save'; document: RemoteText; original: string; overwrite: boolean }
  | { operation: 'create'; path: string; directory: boolean }
  | { operation: 'move'; path: string; destination: string }
  | { operation: 'delete'; path: string }
  | { operation: 'chmod'; path: string; permissions: number }
  | {
      operation: 'transfer'
      id: string
      direction: 'upload' | 'download'
      sources: string[]
      owner?: string
      directories?: Record<string, string>
      completedSources?: string[]
      destination: string
    }
  | { operation: 'cancel'; id: string }
  | { operation: 'resolve'; id: string; choice: 'replace' | 'skip' | 'keepBoth'; all: boolean }
export interface TransferEvent {
  sessionId: string
  id: string
  state: 'running' | 'conflict' | 'completed' | 'failed' | 'cancelled'
  path: string
  bytes: number
  total: number
  message: string | null
  skipped: string[]
  directories?: Record<string, string>
  completedSources?: string[]
}
export const filesApi = {
  request: <T>(sessionId: string, request: FileRequest): Promise<T> => {
    if (!isNative())
      return Promise.reject({
        code: 'native_unavailable',
        message: 'SFTP nécessite Via en mode natif.',
      })
    return invoke<T>('session_files', { id: sessionId, request })
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
