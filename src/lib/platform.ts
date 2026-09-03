export type HostPlatform = 'windows' | 'macos' | 'linux'

export function hostPlatform(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): HostPlatform {
  if (/mac os x|macintosh|darwin/i.test(userAgent)) return 'macos'
  if (/windows|win32/i.test(userAgent) || !userAgent) return 'windows'
  return 'linux'
}
