import type { Id, TargetKind } from '@/ipc/types'

export interface NewTabTarget {
  kind: TargetKind
  id: Id
}

export interface SshConfigurationRequest {
  id: Id | null
  duplicate: boolean
}
