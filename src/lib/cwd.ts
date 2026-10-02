/**
 * Working directories reported by shells: OSC 7 (`file://host/path`) and the
 * Windows Terminal form OSC 9;9 (`9;C:\path`). Paths come back in the form the
 * operating system expects, so they can be handed to a new shell as is.
 */

const BACKSLASH = '\\'

function toNative(path: string, windows: boolean): string {
  if (!windows) return path
  // `/C:/Users` from PowerShell and cmd, `/c/Users` from Git Bash.
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

/** The directory in an OSC 7 payload, or `null` when it is not a local path. */
export function parseOsc7(data: string, windows: boolean): string | null {
  const match = /^file:\/\/[^/]*(\/.*)$/.exec(data.trim())
  if (!match) return null
  const path = decode(match[1]).split(BACKSLASH).join('/')
  return toNative(path, windows) || null
}

/** The directory in an OSC 9;9 payload (`9;path`), or `null`. */
export function parseOsc9(data: string, windows: boolean): string | null {
  const match = /^9;"?([^"]+)"?$/.exec(data.trim())
  if (!match) return null
  return toNative(match[1].split(BACKSLASH).join('/'), windows)
}
