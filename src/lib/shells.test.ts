import { describe, expect, it } from 'vitest'
import { platformDefaultShell, shellLabel } from './shells'

describe('shellLabel', () => {
  it('names Windows PowerShell', () => {
    expect(shellLabel('powershell.exe')).toBe('PowerShell')
  })

  it('names Command Prompt', () => {
    expect(shellLabel('cmd.exe')).toBe('Invite de commandes')
  })

  it('names WSL', () => {
    expect(shellLabel('wsl.exe')).toBe('WSL')
  })

  it('names Git Bash from a Windows path', () => {
    expect(shellLabel(String.raw`C:\Program Files\Git\bin\bash.exe`)).toBe('Git Bash')
  })

  it('names Unix bash as Bash', () => {
    expect(shellLabel('bash')).toBe('Bash')
    expect(shellLabel('/bin/bash')).toBe('Bash')
  })

  it('names zsh', () => {
    expect(shellLabel('/bin/zsh')).toBe('Zsh')
  })

  it('names fish', () => {
    expect(shellLabel('fish')).toBe('Fish')
  })

  it('returns the original executable when the name is unknown', () => {
    expect(shellLabel('/opt/custom/mysh')).toBe('/opt/custom/mysh')
  })
})

describe('platformDefaultShell', () => {
  it('returns a non-empty default', () => {
    expect(platformDefaultShell()).not.toBe('')
  })
})
