const BACKSLASH = '\\'

function toNative(path: string, windows: boolean): string {
  if (!windows) return path

  const drive = /^\/?([a-zA-Z])(?::|(?=\/|$))(.*)$/.exec(path)
  if (!drive) return path
  const rest = drive[2].split('/').join(BACKSLASH)
  return `${drive[1].toUpperCase()}:${rest.startsWith(BACKSLASH) ? rest : BACKSLASH + rest}`
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseOsc7(data: string, windows: boolean): string | null {
  const match = /^file:\/\/[^/]*(\/.*)$/.exec(data.trim())
  if (!match) return null
  const path = decode(match[1]).split(BACKSLASH).join('/')
  return toNative(path, windows) || null
}

export function parseOsc9(data: string, windows: boolean): string | null {
  const match = /^9;"?([^"]+)"?$/.exec(data.trim())
  if (!match) return null
  return toNative(match[1].split(BACKSLASH).join('/'), windows)
}
