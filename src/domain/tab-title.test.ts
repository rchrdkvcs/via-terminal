import { describe, expect, it } from 'vitest'
import { simplifyTitle } from './tab-title'

describe('simplifyTitle', () => {
  it.each([
    ['rchrd@macbook: ~/Lab/via-terminal', 'via-terminal'],
    ['root@web-01:/etc/nginx/', 'nginx'],
    ['root@server: /', '/'],
    ['~/Lab/via-terminal - zsh', 'via-terminal'],
    ['Administrator: C:\\Users\\me\\projects', 'projects'],
  ])('reduces the directory %s to %s', (raw, text) => {
    expect(simplifyTitle(raw)).toEqual({ text, directory: true })
  })

  it.each([
    ['✳ Fix sidebar overflow', 'Fix sidebar overflow'],
    ['⠋ Claude Code', 'Claude Code'],
    ['vim /etc/nginx/sites-enabled/default', 'vim default'],
    ['htop', 'htop'],
    ['npm run dev', 'npm run dev'],
  ])('shortens the command %s to %s', (raw, text) => {
    expect(simplifyTitle(raw)).toEqual({ text, directory: false })
  })

  it.each([
    null,
    '',
    '   ',
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    '/bin/zsh',
    'me@host',
    'me@host:~',
  ])('keeps nothing useful from %s', (raw) => {
    expect(simplifyTitle(raw)).toBeNull()
  })
})
