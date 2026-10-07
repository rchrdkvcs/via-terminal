/** Finish durable writes before any native installer can terminate Via. */
import { useClosing } from '@/composables/useClosing'
import { api } from '@/ipc/client'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { prepareDrafts } from './drafts'

async function flush() {
  await prepareDrafts()
  const results = await Promise.allSettled([
    useSettings().flush(),
    useSpaces().flush(),
    useVault().flush(),
  ])
  const failed = results.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') throw failed.reason
}

export async function prepareUpdate() {
  if (!(await useClosing().leave(flush)))
    throw new Error('La mise à jour a été annulée pour conserver les fichiers ouverts.')
  await api.prepareUpdate()
}
