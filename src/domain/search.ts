function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
}

export function scoreText(query: string, text: string): number {
  const needle = normalize(query).replace(/\s+/g, '')
  const haystack = normalize(text)
  if (!needle) return 1
  if (haystack.startsWith(needle)) return 1000 - haystack.length
  const index = haystack.indexOf(needle)
  if (index >= 0) return 600 - index
  let score = 0
  let cursor = 0
  let run = 0
  for (const char of needle) {
    const found = haystack.indexOf(char, cursor)
    if (found < 0) return 0
    const wordStart = found === 0 || /[\s\-_.@/:]/.test(haystack[found - 1])
    run = found === cursor ? run + 1 : 0
    score += 10 + run * 5 + (wordStart ? 15 : 0)
    cursor = found + 1
  }
  return Math.min(score, 500)
}

export function scoreFields(query: string, fields: Array<string | null | undefined>): number {
  let best = 0
  fields.forEach((field, index) => {
    if (!field) return
    const score = scoreText(query, field) * (index === 0 ? 1 : 0.8)
    best = Math.max(best, score)
  })
  return best
}

export function rank<T>(
  query: string,
  items: T[],
  fields: (item: T) => Array<string | null | undefined>,
): T[] {
  return items
    .map((item) => ({ item, score: scoreFields(query, fields(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}
