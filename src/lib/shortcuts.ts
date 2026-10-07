export type Combo = string[]

export type ActionId =
  | 'newTab'
  | 'retarget'
  | 'actions'
  | 'closeTab'
  | 'pin'
  | 'split'
  | 'nextTab'
  | 'previousTab'
  | 'space'
  | 'sidebar'
  | 'search'
  | 'copy'
  | 'paste'
  | 'settings'
  | 'vault'

export interface Binding {
  id: ActionId
  label: string
  other: Combo
  mac: Combo
}

export const bindings: Binding[] = [
  { id: 'newTab', label: 'Nouvel onglet', other: ['Ctrl', 'Shift', 'T'], mac: ['Cmd', 'T'] },
  {
    id: 'retarget',
    label: 'Changer la cible de l’onglet',
    other: ['Ctrl', 'Shift', 'L'],
    mac: ['Cmd', 'L'],
  },
  { id: 'actions', label: 'Actions', other: ['Ctrl', 'Shift', 'P'], mac: ['Cmd', 'K'] },
  { id: 'closeTab', label: 'Fermer l’onglet', other: ['Ctrl', 'Shift', 'W'], mac: ['Cmd', 'W'] },
  { id: 'pin', label: 'Épingler ou désépingler', other: ['Ctrl', 'Shift', 'D'], mac: ['Cmd', 'D'] },
  {
    id: 'split',
    label: 'Partager la vue',
    other: ['Alt', 'Shift', 'D'],
    mac: ['Cmd', 'Shift', 'D'],
  },
  { id: 'nextTab', label: 'Onglet suivant', other: ['Ctrl', 'Tab'], mac: ['Ctrl', 'Tab'] },
  {
    id: 'previousTab',
    label: 'Onglet précédent',
    other: ['Ctrl', 'Shift', 'Tab'],
    mac: ['Ctrl', 'Shift', 'Tab'],
  },
  { id: 'space', label: 'Espace 1 à 9', other: ['Ctrl', '1…9'], mac: ['Cmd', '1…9'] },
  {
    id: 'sidebar',
    label: 'Afficher ou masquer la barre latérale',
    other: ['Ctrl', 'Shift', 'B'],
    mac: ['Cmd', 'S'],
  },
  {
    id: 'search',
    label: 'Rechercher dans le terminal',
    other: ['Ctrl', 'Shift', 'F'],
    mac: ['Cmd', 'F'],
  },
  { id: 'copy', label: 'Copier la sélection', other: ['Ctrl', 'Shift', 'C'], mac: ['Cmd', 'C'] },
  { id: 'paste', label: 'Coller', other: ['Ctrl', 'Shift', 'V'], mac: ['Cmd', 'V'] },
  { id: 'settings', label: 'Réglages', other: ['Ctrl', ','], mac: ['Cmd', ','] },
  { id: 'vault', label: 'Coffre', other: ['Ctrl', 'Shift', 'H'], mac: ['Cmd', 'Shift', 'H'] },
]

export function comboFor(binding: Binding, platform: string): Combo {
  return platform === 'macos' ? binding.mac : binding.other
}

const macNames: Record<string, string> = { Cmd: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' }
const otherNames: Record<string, string> = { Shift: 'Maj' }

export function keyLabels(combo: Combo, platform: string): string[] {
  const names = platform === 'macos' ? macNames : otherNames
  return combo.map((key) => names[key] ?? key)
}

export function formatShortcut(id: ActionId, platform: string): string {
  const binding = bindings.find((candidate) => candidate.id === id)
  if (!binding) return ''
  return keyLabels(comboFor(binding, platform), platform).join(platform === 'macos' ? '' : ' ')
}

function keyOf(event: KeyboardEvent): string {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3)
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5)
  if (event.code === 'Comma') return ','
  return event.key
}

export function match(
  event: KeyboardEvent,
  platform: string,
): { id: ActionId; digit?: number } | null {
  const key = keyOf(event)
  for (const binding of bindings) {
    const combo = comboFor(binding, platform)
    const wanted = combo[combo.length - 1]
    const modifiers = combo.slice(0, -1)
    const same =
      event.ctrlKey === modifiers.includes('Ctrl') &&
      event.shiftKey === modifiers.includes('Shift') &&
      event.altKey === modifiers.includes('Alt') &&
      event.metaKey === modifiers.includes('Cmd')
    if (!same) continue
    if (wanted === '1…9' && /^[1-9]$/.test(key)) return { id: binding.id, digit: Number(key) }
    if (wanted.toUpperCase() === key.toUpperCase()) return { id: binding.id }
  }
  return null
}

/**
 * Inside a text field or the document editor only navigation and global actions apply;
 * tab, terminal and clipboard actions are left to the field (Cmd+S saves a document).
 */
const whileEditing = new Set<ActionId>([
  'newTab',
  'actions',
  'closeTab',
  'split',
  'nextTab',
  'previousTab',
  'space',
  'settings',
  'vault',
])
export function appliesWhileEditing(id: ActionId): boolean {
  return whileEditing.has(id)
}

// This binding applies only while the remote document editor has focus.
export const documentSaveKey = 'Mod-s'
