/** Available session types in the new-tab picker. Add new types here as their
 * session implementations become available, then supply a picker panel. */
export const tabTypes = [
  { id: 'local', label: 'Terminal local', description: 'Ouvrir un shell sur cet appareil.' },
  {
    id: 'ssh',
    label: 'SSH',
    description: 'Ouvrir une connexion distante enregistrée ou en créer une.',
  },
] as const

export type TabTypeId = (typeof tabTypes)[number]['id']
