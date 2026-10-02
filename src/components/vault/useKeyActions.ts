/** Key operations shared by the key list and the key inspector. */
import { api } from '@/ipc/client'
import type { Id, Key } from '@/ipc/types'
import { notify } from '@/lib/notify'
import { useVault } from '@/stores/vault'
import { useVaultActions } from './useVaultActions'

export function useKeyActions() {
  const vault = useVault()
  const { run } = useVaultActions()

  async function copyPublicKey(key: Pick<Key, 'publicKey'>) {
    try {
      await navigator.clipboard.writeText(key.publicKey)
      notify.success('Clé publique copiée')
    } catch {
      notify.error(
        'Impossible d’écrire dans le presse-papiers. Sélectionnez la clé publique et copiez-la à la main.',
      )
    }
  }

  async function rename(id: Id, label: string | null) {
    if (label) await run(() => api.vault.renameKey(id, label))
  }

  async function generate(label: string): Promise<Id | null> {
    const id = await run(() => api.vault.generateKey(label))
    const key = vault.view.keys.find((candidate) => candidate.id === id)
    if (key) {
      notify.success('Clé générée. Ajoutez sa clé publique aux serveurs qui doivent l’accepter.', {
        label: 'Copier',
        run: () => void copyPublicKey(key),
      })
    }
    return id
  }

  return { copyPublicKey, rename, generate }
}
