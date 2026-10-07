import { invoke } from '@tauri-apps/api/core'
import { isNative } from './client'
import type { FileRequest, FilesReply, Listing, RemoteText } from './bindings'

export type {
  Collision,
  EntryKind,
  FileRequest,
  Listing,
  NativeTransferState,
  RemoteEntry,
  RemoteOwner,
  RemoteText,
  TransferDirection,
  TransferEvent,
  TransferPlan,
} from './bindings'

/** Narrows Rust's untagged reply per operation; every operation must map to one of its shapes. */
type Replies<T extends Record<FileRequest['operation'], FilesReply>> = T
type FileReplies = Replies<{
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
}>
export type FileReply<R extends FileRequest> = FileReplies[R['operation']]
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
  /** Sent as raw bytes: the path's length (u32, big-endian), the UTF-8 path, then the data. */
  stageChunk: (id: string, path: string, data: Uint8Array) => {
    const name = new TextEncoder().encode(path)
    const body = new Uint8Array(4 + name.length + data.length)
    new DataView(body.buffer).setUint32(0, name.length)
    body.set(name, 4)
    body.set(data, 4 + name.length)
    return invoke<void>('files_stage_chunk', body, { headers: { 'Via-Staging': id } })
  },
  stageFinish: (id: string) => invoke<string[]>('files_stage_finish', { id }),
  stageDiscard: (id: string) => invoke<void>('files_stage_discard', { id }),
}
