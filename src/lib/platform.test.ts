import { describe, expect, it } from 'vitest'
import { hostPlatform } from './platform'

describe('hostPlatform', () => {
  it('detects desktop platforms', () => {
    expect(hostPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(hostPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos')
    expect(hostPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
  })

  it('uses the Windows fallback required by CI', () => {
    expect(hostPlatform('')).toBe('windows')
  })
})
