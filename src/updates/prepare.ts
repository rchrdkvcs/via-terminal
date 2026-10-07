/** Finish durable writes before any native installer can terminate Via. */
import { useFiles } from '@/stores/files'
import { useFileProtection } from '@/composables/useFileProtection'
import { api } from '@/ipc/client'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { prepareDrafts } from './drafts'
import { flushVaultSaves } from '@/components/vault/saveQueue'

export async function prepareUpdate() {
  const files = useFiles()
  if (
    Object.keys(files.panels).length &&
    !(await useFileProtection().protect(Object.keys(files.panels)))
  )
    throw new Error('La mise à jour a été annulée pour conserver les fichiers ouverts.')
  await prepareDrafts()
  await flushVaultSaves()
  const results = await Promise.allSettled([
    useSettings().flush(),
    useSpaces().flush(),
    useVault().flush(),
  ])
  const failed = results.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') throw failed.reason
  await api.prepareUpdate()
}
