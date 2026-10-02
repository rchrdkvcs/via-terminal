/**
 * OKLCH to sRGB hex, for the few consumers that cannot read CSS colors
 * (xterm paints on a canvas). Formulas from Björn Ottosson's OKLab definition.
 */
function toSrgb(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear))
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
}

export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const radians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(radians)
  const b = chroma * Math.sin(radians)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return `#${rgb
    .map((channel) =>
      Math.round(toSrgb(channel) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
