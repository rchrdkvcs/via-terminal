import { vi } from 'vitest'
import { ref } from 'vue'
import { api } from '@/ipc/client'
import type { HostInput, SecretUpdate } from '@/ipc/types'
import { useDraft } from '@/components/vault/useDraft'
import { useVault } from '@/stores/vault'

export interface Record {
  id: string | null
  name: string
  password: SecretUpdate
}

interface Call {
  input: Record
  resolve: (id: string | null) => void
  reject: (cause: unknown) => void
}

export function deferredBackend() {
  const calls: Call[] = []
  const save = vi.fn(
    (input: Record) =>
      new Promise<string | null>((resolve, reject) => calls.push({ input, resolve, reject })),
  )

  async function settle(result: string | null | Error) {
    const call = calls.shift()
    if (!call) throw new Error('no pending save')
    if (result instanceof Error) call.reject(result)
    else call.resolve(result)
    await flush()
  }
  const inputs = () => save.mock.calls.map(([input]) => input)
  return { save, calls, settle, inputs, last: () => inputs()[inputs().length - 1] }
}

export function record(id: string | null, name = 'one'): Record {
  return { id, name, password: { action: 'keep' } }
}

/** Routes the vault store's host saves to `save`; the reply keeps the current view. */
export function hostBackend(save: (input: Record) => Promise<string | null>) {
  const vault = useVault()
  vi.spyOn(api.vault, 'saveHost').mockImplementation(async (input: HostInput) => ({
    id: await save(input as unknown as Record),
    vault: vault.view,
  }))
}

export function editor(initial: Record, save: (input: Record) => Promise<string | null>) {
  hostBackend(save)
  const stored = ref(initial)
  const validate = (input: Record) => (input.name ? null : 'Ajoutez un nom.')
  return { stored, ...useDraft({ kind: 'host', source: () => stored.value, validate }) }
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
