import type { HostInput, IdentityInput } from '@/ipc/types'

export { groupInput, hostInput, identityInput } from '@/stores/vault-inputs'

export function requireAddress(input: HostInput): string | null {
  return input.address.trim() ? null : 'Ajoutez une adresse : un nom de domaine ou une IP.'
}

export function requireUsername(input: IdentityInput): string | null {
  return input.username.trim()
    ? null
    : 'Ajoutez un nom d’utilisateur : c’est ce que l’identité apporte aux hôtes.'
}
