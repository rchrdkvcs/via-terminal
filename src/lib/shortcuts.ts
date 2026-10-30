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

export type BindingGroup = 'tabs' | 'navigation' | 'terminal' | 'app'

export const groupLabels: Record<BindingGroup, string> = {
  tabs: 'Onglets',
  navigation: 'Navigation',
  terminal: 'Terminal',
  app: 'Application',
}

export interface Binding {
  id: ActionId
  label: string
  group: BindingGroup
  other: Combo
  mac: Combo
}

/** Shortcut overrides chosen by the user, by action id. */
export type Overrides = Partial<Record<string, Combo>>

export const bindings: Binding[] = [
  {
    id: 'newTab',
    group: 'tabs',
    label: 'Nouvel onglet',
    other: ['Ctrl', 'Shift', 'T'],
    mac: ['Cmd', 'T'],
  },
  {
    id: 'retarget',
    group: 'tabs',
    label: 'Changer la cible de l’onglet',
    other: ['Ctrl', 'Shift', 'L'],
    mac: ['Cmd', 'L'],
  },
  {
    id: 'actions',
    group: 'app',
    label: 'Actions',
    other: ['Ctrl', 'Shift', 'P'],
    mac: ['Cmd', 'K'],
  },
  {
    id: 'closeTab',
    group: 'tabs',
    label: 'Fermer l’onglet',
    other: ['Ctrl', 'Shift', 'W'],
    mac: ['Cmd', 'W'],
  },
  {
    id: 'pin',
    group: 'tabs',
    label: 'Épingler ou désépingler',
    other: ['Ctrl', 'Shift', 'D'],
    mac: ['Cmd', 'D'],
  },
  {
    id: 'split',
    group: 'tabs',
    label: 'Partager la vue',
    other: ['Alt', 'Shift', 'D'],
    mac: ['Cmd', 'Shift', 'D'],
  },
  {
    id: 'nextTab',
    group: 'navigation',
    label: 'Onglet suivant',
    other: ['Ctrl', 'Tab'],
    mac: ['Ctrl', 'Tab'],
  },
  {
    id: 'previousTab',
    group: 'navigation',
    label: 'Onglet précédent',
    other: ['Ctrl', 'Shift', 'Tab'],
    mac: ['Ctrl', 'Shift', 'Tab'],
  },
  {
    id: 'space',
    group: 'navigation',
    label: 'Espace 1 à 9',
    other: ['Ctrl', '1…9'],
    mac: ['Cmd', '1…9'],
  },
  {
    id: 'sidebar',
    group: 'navigation',
    label: 'Afficher ou masquer la barre latérale',
    other: ['Ctrl', 'Shift', 'B'],
    mac: ['Cmd', 'S'],
  },
  {
    id: 'search',
    group: 'terminal',
    label: 'Rechercher dans le terminal',
    other: ['Ctrl', 'Shift', 'F'],
    mac: ['Cmd', 'F'],
  },
  {
    id: 'copy',
    group: 'terminal',
    label: 'Copier la sélection',
    other: ['Ctrl', 'Shift', 'C'],
    mac: ['Cmd', 'C'],
  },
  {
    id: 'paste',
    group: 'terminal',
    label: 'Coller',
    other: ['Ctrl', 'Shift', 'V'],
    mac: ['Cmd', 'V'],
  },
  { id: 'settings', group: 'app', label: 'Réglages', other: ['Ctrl', ','], mac: ['Cmd', ','] },
  {
    id: 'vault',
    group: 'app',
    label: 'Coffre',
    other: ['Ctrl', 'Shift', 'H'],
    mac: ['Cmd', 'Shift', 'H'],
  },
]

export function defaultCombo(binding: Binding, platform: string): Combo {
  return platform === 'macos' ? binding.mac : binding.other
}

export function comboFor(binding: Binding, platform: string, overrides: Overrides = {}): Combo {
  return (editable(binding.id) && overrides[binding.id]) || defaultCombo(binding, platform)
}

/** Switching spaces takes a digit, so its combination stays fixed. */
export function editable(id: ActionId): boolean {
  return id !== 'space'
}

const keyNames: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ' ': 'Espace',
}
const macNames: Record<string, string> = {
  Cmd: '⌘',
  Shift: '⇧',
  Alt: '⌥',
  Ctrl: '⌃',
  Enter: '↩',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
  Escape: 'Échap',
}
const otherNames: Record<string, string> = {
  Shift: 'Maj',
  Enter: 'Entrée',
  Backspace: 'Retour',
  Delete: 'Suppr',
  Escape: 'Échap',
}

export function keyLabels(combo: Combo, platform: string): string[] {
  const names = platform === 'macos' ? macNames : otherNames
  return combo.map((key) => names[key] ?? keyNames[key] ?? key)
}

export function formatCombo(combo: Combo, platform: string): string {
  return keyLabels(combo, platform).join(platform === 'macos' ? '' : ' ')
}

export function formatShortcut(id: ActionId, platform: string, overrides: Overrides = {}): string {
  const binding = bindings.find((candidate) => candidate.id === id)
  if (!binding) return ''
  return formatCombo(comboFor(binding, platform, overrides), platform)
}

function keyOf(event: KeyboardEvent): string {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3)
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5)
  if (event.code === 'Comma') return ','
  return event.key.length === 1 ? event.key.toUpperCase() : event.key
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn'])

/** The combination a key press spells, modifiers first; `null` while only modifiers are held. */
export function comboOf(event: KeyboardEvent): Combo | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  const combo: Combo = []
  if (event.ctrlKey) combo.push('Ctrl')
  if (event.altKey) combo.push('Alt')
  if (event.shiftKey) combo.push('Shift')
  if (event.metaKey) combo.push('Cmd')
  combo.push(keyOf(event))
  return combo
}

export function sameCombo(a: Combo, b: Combo): boolean {
  const key = (combo: Combo) => combo.slice(0, -1).sort().join('+') + '|' + combo[combo.length - 1]
  return key(a) === key(b)
}

/** Keys the operating system or the native menu catch before the window sees them. */
const reservedOnMac = [
  ['Cmd', 'Q'],
  ['Cmd', 'H'],
  ['Alt', 'Cmd', 'H'],
  ['Cmd', 'M'],
  ['Cmd', 'Tab'],
  ['Ctrl', 'Cmd', 'F'],
]

/** Why a combination cannot be used, or `null` when it can. */
export function refusal(
  combo: Combo,
  id: ActionId,
  platform: string,
  overrides: Overrides = {},
): string | null {
  const modifiers = combo.slice(0, -1)
  const key = combo[combo.length - 1]
  if (!modifiers.length && !/^F([1-9]|1[0-2])$/.test(key))
    return 'Ajoutez une touche de modification (Ctrl, Alt, Maj ou ⌘).'
  if (modifiers.length === 1 && modifiers[0] === 'Shift' && key.length === 1)
    return 'Maj seule sert à taper des majuscules. Ajoutez une autre touche.'
  if (platform === 'macos' && reservedOnMac.some((taken) => sameCombo(taken, combo)))
    return 'macOS réserve ce raccourci.'
  const space = bindings.find((binding) => binding.id === 'space')!
  const spaceModifiers = defaultCombo(space, platform).slice(0, -1)
  if (/^[1-9]$/.test(key) && sameCombo([...spaceModifiers, key], combo))
    return `Déjà utilisé par « ${space.label} ».`
  const taken = bindings.find(
    (binding) => binding.id !== id && sameCombo(comboFor(binding, platform, overrides), combo),
  )
  return taken ? `Déjà utilisé par « ${taken.label} ».` : null
}

export function match(
  event: KeyboardEvent,
  platform: string,
  overrides: Overrides = {},
): { id: ActionId; digit?: number } | null {
  const key = keyOf(event)
  for (const binding of bindings) {
    const combo = comboFor(binding, platform, overrides)
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
