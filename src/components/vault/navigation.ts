/** Which row arrow keys, Home and End land on. Null means the key does not move. */
export function step(ids: string[], current: string | null, key: string): string | null {
  if (!ids.length) return null
  const index = current ? ids.indexOf(current) : -1
  switch (key) {
    case 'ArrowDown':
      return ids[Math.min(index + 1, ids.length - 1)]
    case 'ArrowUp':
      return ids[index < 0 ? ids.length - 1 : Math.max(index - 1, 0)]
    case 'Home':
      return ids[0]
    case 'End':
      return ids[ids.length - 1]
    default:
      return null
  }
}
