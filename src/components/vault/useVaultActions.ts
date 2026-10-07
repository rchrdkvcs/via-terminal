import { api, describeError } from '@/ipc/client'
import type { Id, Mutation } from '@/ipc/types'
import { notify } from '@/lib/notify'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'

export function useVaultActions() {
  const vault = useVault()
  const ui = useUi()

  async function run(task: () => Promise<Mutation>): Promise<Id | null> {
    try {
      return await vault.mutate(task)
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
    run: () => Promise<Mutation>
    id: Id
  }) {
    ui.confirm({
      title: request.title,
      description: request.description,
      confirm: 'Supprimer',
      destructive: true,
      run: () => void run(request.run).then(() => forget(request.id)),
    })
  }

  function connect(hostId: Id) {
    useWorkbench().open({ kind: 'host', hostId })
    ui.route = 'workbench'
  }

  async function duplicateHost(id: Id) {
    const copy = await run(() => api.vault.duplicateHost(id))
    if (copy) ui.vaultFocus = { section: 'hosts', id: copy }
  }

  function deleteHost(id: Id) {
    const host = vault.host(id)
    remove({
      id,
      title: `Supprimer « ${host?.label ?? 'cet hôte'} » ?`,
      description:
        'L’hôte et son mot de passe enregistré sont retirés du coffre. Les onglets épinglés qui l’utilisent restent et indiqueront que leur hôte n’existe plus.',
      run: () => api.vault.deleteHost(id),
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
      run: () => api.vault.deleteGroup(id),
    })
  }

  function deleteIdentity(id: Id) {
    const identity = vault.view.identities.find((item) => item.id === id)
    remove({
      id,
      title: `Supprimer l’identité « ${identity?.label ?? ''} » ?`,
      description:
        'Les hôtes et groupes qui l’utilisent perdent cette référence et reprennent les valeurs héritées. Son mot de passe enregistré est oublié.',
      run: () => api.vault.deleteIdentity(id),
    })
  }

  function deleteKey(id: Id) {
    const key = vault.view.keys.find((item) => item.id === id)
    remove({
      id,
      title: `Supprimer la clé « ${key?.label ?? ''} » ?`,
      description:
        'La clé privée est effacée du coffre et ne pourra pas être récupérée. Les hôtes et identités qui l’utilisent n’auront plus de clé.',
      run: () => api.vault.deleteKey(id),
    })
  }

  function deleteKnownHost(id: Id) {
    const known = vault.view.knownHosts.find((item) => item.id === id)
    remove({
      id,
      title: `Oublier l’empreinte de ${known ? `${known.address}:${known.port}` : 'ce serveur'} ?`,
      description: 'La prochaine connexion redemandera de vérifier ce serveur.',
      run: () => api.vault.deleteKnownHost(id),
    })
  }

  async function createGroup(parentId: Id | null): Promise<Id | null> {
    const defaults = { username: null, port: null, identityId: null }
    return run(() => api.vault.saveGroup({ id: null, parentId, name: 'Nouveau groupe', defaults }))
  }

  return {
    run,
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
