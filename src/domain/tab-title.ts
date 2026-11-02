export interface ShortTitle {
  text: string
  directory: boolean
}

/**
 * Shortens a title reported by the terminal (OSC 0/2) to what tells tabs apart in the sidebar:
 * no status glyphs, no `user@host:` prompt prefix, no shell suffix, and paths reduced to their
 * last segment. Returns null when nothing useful is left (including the bare home directory), so
 * the target name is shown instead. `directory` tells a working directory from a command.
 */
export function simplifyTitle(raw: string | null): ShortTitle | null {
  if (!raw) return null
  let title = raw
    .trim()
    // Spinners and status marks some programs put in front (⠋, ✳, ●, ★ …).
    .replace(/^[^\p{L}\p{N}~/\\.$[(]+\s*/u, '')
    // Windows consoles: "Administrator: …", "Administrateur : …".
    .replace(/^(administrat(or|eur))\s*:\s*/i, '')
    // "… - zsh", "… — bash".
    .replace(/\s+[-–—]\s+(zsh|bash|fish|sh|nu|pwsh|powershell)$/i, '')
    .trim()

  // Shell prompt titles: "user@host: ~/path", "user@host:~/path", "user@host".
  const prompt = /^[\w.-]+@[\w.-]+(?::\s*(.*))?$/.exec(title)
  if (prompt) title = prompt[1]?.trim() || ''

  if (!title || /\.exe$/i.test(title) || /^(\/usr)?\/bin\/[\w.-]+$/.test(title)) return null
  if (isPath(title)) {
    const text = lastSegment(title)
    return text === '~' ? null : { text, directory: true }
  }

  // A command line: keep the command, shorten path arguments.
  const text = title
    .split(/\s+/)
    .map((word, index) => (index > 0 && isPath(word) ? lastSegment(word) : word))
    .join(' ')
  return { text, directory: false }
}

function isPath(value: string): boolean {
  return /^(~|\/|[A-Za-z]:\\|\.{1,2}\/)/.test(value) && !/\s/.test(value)
}

function lastSegment(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  if (!trimmed) return '/'
  if (trimmed === '~' || /^[A-Za-z]:$/.test(trimmed)) return trimmed
  return trimmed.split(/[\\/]/).pop() || path
}
