/** Finish durable writes before any native installer can terminate Via. */
import { api } from '@/ipc/client'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { prepareDrafts } from './drafts'
import { flushVaultSaves } from '@/components/vault/saveQueue'

export async function prepareUpdate() {
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
