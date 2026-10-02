import { describe, expect, it } from 'vitest'
import { parseOsc7, parseOsc9 } from './cwd'

describe('working directory reports', () => {
  it('reads Git Bash, PowerShell and cmd paths on Windows', () => {
    expect(parseOsc7('file://localhost/c/Users/B34R/Desktop/Lab', true)).toBe(
      'C:\\Users\\B34R\\Desktop\\Lab',
    )
    expect(parseOsc7('file://localhost/C:/Users/B34R', true)).toBe('C:\\Users\\B34R')
    expect(parseOsc7('file://localhost/C:\\Windows\\System32', true)).toBe('C:\\Windows\\System32')
    expect(parseOsc7('file://localhost/d', true)).toBe('D:\\')
    expect(parseOsc9('9;"C:\\Projets\\Via"', true)).toBe('C:\\Projets\\Via')
  })

  it('keeps Unix paths and decodes escapes', () => {
    expect(parseOsc7('file://mac.local/Users/me/My%20Lab', false)).toBe('/Users/me/My Lab')
    expect(parseOsc7('file:///home/me', false)).toBe('/home/me')
  })

  it('ignores what is not a local directory', () => {
    expect(parseOsc7('https://example.com', false)).toBeNull()
    expect(parseOsc9('4;1;50', true)).toBeNull()
  })
})
