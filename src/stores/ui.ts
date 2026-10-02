import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Id } from '@/ipc/types'

export type Route = 'workbench' | 'vault' | 'settings'

/**
 * What the command bar is for: a new tab, retargeting the current one,
 * actions first, or choosing the second tab of a split.
 */
export type CommandMode =
  | { kind: 'new' }
  | { kind: 'replace'; tabId: Id }
  | { kind: 'actions' }
  | { kind: 'split'; tabId: Id }

export interface Confirmation {
  title: string
  description: string
  confirm: string
  destructive?: boolean
  run: () => void
}

/** Transient interface state; nothing here is persisted. */
export const useUi = defineStore('ui', () => {
  const route = ref<Route>('workbench')
  const command = ref<CommandMode | null>(null)
  const renaming = ref<Id | null>(null)
  const spaceForm = ref<{ id: Id | null } | null>(null)
  const confirmation = ref<Confirmation | null>(null)
  const vaultFocus = ref<{
    section: 'hosts' | 'identities' | 'keys' | 'knownHosts'
    id: Id | null
  }>({
    section: 'hosts',
    id: null,
  })
  const searching = ref(false)

  function openCommand(mode: CommandMode = { kind: 'new' }) {
    command.value = mode
  }

  function closeCommand() {
    command.value = null
  }

  function confirm(request: Confirmation) {
    confirmation.value = request
  }

  function showVault(
    section: (typeof vaultFocus.value)['section'] = 'hosts',
    id: Id | null = null,
  ) {
    vaultFocus.value = { section, id }
    route.value = 'vault'
  }

  return {
    route,
    command,
    renaming,
    spaceForm,
    confirmation,
    vaultFocus,
    searching,
    openCommand,
    closeCommand,
    confirm,
    showVault,
  }
})
