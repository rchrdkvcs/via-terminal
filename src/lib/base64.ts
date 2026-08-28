/**
 * PTY output crosses the IPC boundary as base64. `Uint8Array.from(binary, cb)`
 * invokes a JavaScript callback per byte, which dominates the frame budget once
 * a shell starts streaming; an indexed loop over the same string does not.
 */
export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let index = 0; index < length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** Join buffered chunks so xterm receives one write per animation frame. */
export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0]
  let total = 0
  for (const chunk of chunks) total += chunk.length
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}
