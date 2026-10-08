import type { FailureReason, SessionState } from '@/ipc/types'

/** What the session animation shows: one step of the connection, or how it ended. */
export type SessionScene =
  | 'asleep'
  | 'connecting'
  | 'verifying'
  | 'authenticating'
  | 'ready'
  | 'unreachable'
  | 'refused'
  | 'hostKey'
  | 'failed'
  | 'disconnected'
  | 'exited'

/** How serious the scene is: a warning can fix itself on retry, danger needs the user. */
export type SceneTone = 'neutral' | 'warning' | 'danger'

const FAILURES: Record<FailureReason, SessionScene> = {
  unreachable: 'unreachable',
  authentication: 'refused',
  hostKey: 'hostKey',
  cancelled: 'exited',
  other: 'failed',
}

const TONES: Partial<Record<SessionScene, SceneTone>> = {
  unreachable: 'warning',
  disconnected: 'warning',
  refused: 'danger',
  hostKey: 'danger',
  failed: 'danger',
}

export function sessionScene(
  state: SessionState | 'asleep',
  reason: FailureReason | null,
): SessionScene {
  return state === 'failed' ? FAILURES[reason ?? 'other'] : state
}

export function sceneTone(scene: SessionScene): SceneTone {
  return TONES[scene] ?? 'neutral'
}
