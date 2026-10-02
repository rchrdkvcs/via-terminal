/**
 * Space colors. A space only stores a name; the hue tints the whole window
 * chrome through the `--space-hue` custom property.
 */
export const spaceColors = [
  { id: 'slate', label: 'Ardoise', hue: 255 },
  { id: 'ocean', label: 'Océan', hue: 230 },
  { id: 'teal', label: 'Sarcelle', hue: 190 },
  { id: 'moss', label: 'Mousse', hue: 145 },
  { id: 'amber', label: 'Ambre', hue: 75 },
  { id: 'coral', label: 'Corail', hue: 35 },
  { id: 'rose', label: 'Rose', hue: 0 },
  { id: 'violet', label: 'Violet', hue: 295 },
] as const

export type SpaceColor = (typeof spaceColors)[number]['id']

export function hueOf(color: string): number {
  return spaceColors.find((candidate) => candidate.id === color)?.hue ?? spaceColors[0].hue
}

/** Lucide icon names offered for spaces, with their accessible names. */
export const spaceIcons = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'server', label: 'Serveur' },
  { id: 'briefcase', label: 'Mallette' },
  { id: 'house', label: 'Maison' },
  { id: 'cloud', label: 'Nuage' },
  { id: 'database', label: 'Base de données' },
  { id: 'shield', label: 'Bouclier' },
  { id: 'flask-conical', label: 'Fiole' },
  { id: 'building-2', label: 'Bâtiment' },
  { id: 'globe', label: 'Globe' },
  { id: 'code', label: 'Code' },
  { id: 'wrench', label: 'Clé à molette' },
] as const
