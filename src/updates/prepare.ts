/** Finish durable writes before any native installer can terminate Via. */
import { useFiles } from '@/stores/files'
import { useFileProtection } from '@/composables/useFileProtection'
import { api } from '@/ipc/client'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { prepareDrafts } from './drafts'

export async function prepareUpdate() {
  const files = useFiles()
  const protection = useFileProtection()
  const decision = await protection.protect(Object.keys(files.panels))
  if (!decision)
    throw new Error('La mise à jour a été annulée pour conserver les fichiers ouverts.')
  await prepareDrafts()
  const results = await Promise.allSettled([
    useSettings().flush(),
    useSpaces().flush(),
    useVault().flush(),
  ])
  const failed = results.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') throw failed.reason
  if (!protection.current(decision))
    throw new Error('Des fichiers ont changé pendant la préparation. Relancez la mise à jour.')
  await api.prepareUpdate()
}
