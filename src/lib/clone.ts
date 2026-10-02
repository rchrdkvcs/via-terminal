/**
 * Deep copy of plain JSON data. `structuredClone` refuses Vue's reactive
 * proxies, and layouts are JSON by contract, so this is both safe and exact.
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
