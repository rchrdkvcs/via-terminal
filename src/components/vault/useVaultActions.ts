import { api, describeError } from '@/ipc/client'
import type { Id, Mutation } from '@/ipc/types'
import { notify } from '@/lib/notify'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'

export function useVaultActions() {
  const vault = useVault()
  const ui = useUi()

  function run(task: () => Promise<Mutation>): Promise<Id | null> {
    return attempt(() => vault.mutate(task))
  }

  async function attempt(task: () => Promise<Id | null>): Promise<Id | null> {
    try {
      return await task()
    } catch (cause) {
      notify.error(describeError(cause))
      return null
    }
  }

  function forget(id: Id) {
    if (ui.vaultFocus.id === id) ui.vaultFocus = { section: ui.vaultFocus.section, id: null }
  }

  function remove(request: {
    title: string
    description: string
    run: () => Promise<Id | null>
    id: Id
  }) {
    ui.confirm({
      title: request.title,
      description: request.description,
      confirm: 'Supprimer',
      destructive: true,
      run: () => void attempt(request.run).then(() => forget(request.id)),
    })
  }

  function connect(hostId: Id) {
    useWorkbench().open({ kind: 'host', hostId })
    ui.route = 'workbench'
  }

  async function duplicateHost(id: Id) {
    const copy = await attempt(() => vault.duplicateHost(id))
    if (copy) ui.vaultFocus = { section: 'hosts', id: copy }
  }

  function deleteHost(id: Id) {
    const host = vault.host(id)
    remove({
      id,
      title: `Supprimer « ${host?.label ?? 'cet hôte'} » ?`,
      description:
        'L’hôte et son mot de passe enregistré sont retirés du coffre. Les onglets épinglés qui l’utilisent restent et indiqueront que leur hôte n’existe plus.',
      run: () => vault.remove('host', id),
    })
  }

  function deleteGroup(id: Id) {
    const group = vault.group(id)
    const parent = vault.group(group?.parentId ?? null)
    const destination = parent ? `dans « ${parent.name} »` : 'à la racine'
    remove({
      id,
      title: `Supprimer le groupe « ${group?.name ?? ''} » ?`,
      description: `Ses hôtes et ses sous-groupes remontent ${destination}. Aucun hôte n’est supprimé, mais ils perdent les valeurs par défaut de ce groupe.`,
      run: () => vault.remove('group', id),
    })
  }

  function deleteIdentity(id: Id) {
    const identity = vault.view.identities.find((item) => item.id === id)
    remove({
      id,
      title: `Supprimer l’identité « ${identity?.label ?? ''} » ?`,
      description:
        'Les hôtes et groupes qui l’utilisent perdent cette référence et reprennent les valeurs héritées. Son mot de passe enregistré est oublié.',
      run: () => vault.remove('identity', id),
    })
  }

  function deleteKey(id: Id) {
    const key = vault.view.keys.find((item) => item.id === id)
    remove({
      id,
      title: `Supprimer la clé « ${key?.label ?? ''} » ?`,
      description:
        'La clé privée est effacée du coffre et ne pourra pas être récupérée. Les hôtes et identités qui l’utilisent n’auront plus de clé.',
      run: () => vault.mutate(() => api.vault.deleteKey(id)),
    })
  }

  function deleteKnownHost(id: Id) {
    const known = vault.view.knownHosts.find((item) => item.id === id)
    remove({
      id,
      title: `Oublier l’empreinte de ${known ? `${known.address}:${known.port}` : 'ce serveur'} ?`,
      description: 'La prochaine connexion redemandera de vérifier ce serveur.',
      run: () => vault.mutate(() => api.vault.deleteKnownHost(id)),
    })
  }

  function createGroup(parentId: Id | null): Promise<Id | null> {
    return attempt(() => vault.createGroup(parentId))
  }

  return {
    run,
    attempt,
    connect,
    duplicateHost,
    deleteHost,
    deleteGroup,
    deleteIdentity,
    deleteKey,
    deleteKnownHost,
    createGroup,
  }
}
