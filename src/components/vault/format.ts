/** Small display and parsing helpers for vault records. */

/** Keeps both ends of a fingerprint, which is how people compare them. */
export function truncateMiddle(text: string, max = 24): string {
  if (text.length <= max) return text
  const keep = max - 1
  const head = Math.ceil(keep / 2)
  return `${text.slice(0, head)}…${text.slice(text.length - (keep - head))}`
}

const HOUR = 3_600_000
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * HOUR],
  ['month', 30 * 24 * HOUR],
  ['week', 7 * 24 * HOUR],
  ['day', 24 * HOUR],
  ['hour', HOUR],
  ['minute', 60_000],
]

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

export function relativeTime(at: number, now = Date.now()): string {
  const elapsed = now - at
  for (const [unit, size] of units) {
    if (Math.abs(elapsed) >= size) return relative.format(-Math.round(elapsed / size), unit)
  }
  return 'à l’instant'
}

const dates = new Intl.DateTimeFormat('fr', { dateStyle: 'medium' })

export function formatDate(at: number): string {
  return dates.format(at)
}

/** Adds typed text as tags, split on commas, without blanks or duplicates. */
export function addTags(tags: string[], text: string): string[] {
  const next = [...tags]
  for (const tag of text.split(',').map((part) => part.trim())) {
    const known = next.some((existing) => existing.toLowerCase() === tag.toLowerCase())
    if (tag && !known) next.push(tag)
  }
  return next
}

/** A port typed by hand: empty means inherit, `undefined` means invalid. */
export function parsePort(text: string): number | null | undefined {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return /^\d+$/.test(trimmed) && value >= 1 && value <= 65535 ? value : undefined
}
