import type { RemoteEntry } from '@/ipc/files'

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** Human-readable size of a listed entry; folders and links have none. */
export const entrySize = (entry: RemoteEntry) =>
  entry.kind !== 'file'
    ? '—'
    : entry.size < 1024
      ? `${entry.size} o`
      : entry.size < 1024 * 1024
        ? `${number.format(entry.size / 1024)} Ko`
        : `${number.format(entry.size / 1024 / 1024)} Mo`
