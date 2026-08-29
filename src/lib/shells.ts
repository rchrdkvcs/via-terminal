/** Display name for a detected shell executable. */
export function shellLabel(executable: string): string {
  const name = executable.replace(/^.*[/\\]/, '').toLowerCase()
  switch (name) {
    case 'powershell.exe':
      return 'PowerShell'
    case 'pwsh.exe':
      return 'PowerShell 7'
    case 'cmd.exe':
      return 'Invite de commandes'
    case 'wsl.exe':
      return 'WSL'
    case 'zsh':
      return 'Zsh'
    case 'bash.exe':
    case 'bash':
      return 'Git Bash'
    case 'sh':
      return 'Sh'
    default:
      return executable
  }
}
