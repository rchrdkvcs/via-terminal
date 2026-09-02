/** Cross-platform monospace stack for xterm and the settings preview. */
export const MONO_FONT_STACK =
  'Cascadia Mono, Cascadia Code, SF Mono, Menlo, Ubuntu Mono, DejaVu Sans Mono, ui-monospace, Consolas, monospace'

/** Display name for a detected shell executable. */
export function shellLabel(executable: string): string {
  const name = executable.replace(/^.*[/\\]/, '').toLowerCase()
  switch (name) {
    case 'powershell.exe':
      return 'PowerShell'
    case 'pwsh.exe':
    case 'pwsh':
      return 'PowerShell 7'
    case 'cmd.exe':
      return 'Invite de commandes'
    case 'wsl.exe':
      return 'WSL'
    case 'zsh':
      return 'Zsh'
    case 'bash.exe':
      return 'Git Bash'
    case 'bash':
      return 'Bash'
    case 'fish':
      return 'Fish'
    case 'sh':
      return 'Sh'
    default:
      return executable
  }
}

/**
 * Host default used before settings are loaded. `navigator.userAgent` is the
 * only signal available in the webview and in jsdom; missing UA falls back to
 * PowerShell so Windows CI stays deterministic.
 */
export function platformDefaultShell(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (!ua) return 'powershell.exe'
  if (/windows|win32/i.test(ua)) return 'powershell.exe'
  if (/mac os x|macintosh|darwin/i.test(ua)) return '/bin/zsh'
  return '/bin/bash'
}
