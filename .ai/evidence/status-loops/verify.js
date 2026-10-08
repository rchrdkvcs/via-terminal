/** Browser checks against the real Vue components in preview.html. */
export async function verifyLoops() {
  const results = []
  const animations = document.getAnimations()
  for (const animation of animations) {
    if (!/^(fade-midway|bounce-key|spark|ripple|flash|jitter)-/.test(animation.animationName))
      continue
    animation.pause()
    const timing = animation.effect.getTiming()
    const target = animation.effect.target
    const read = (time) => {
      animation.currentTime = timing.delay + time
      const style = getComputedStyle(target)
      return {
        opacity: style.opacity,
        transform: style.transform,
        fill: style.fill,
        stroke: style.stroke,
      }
    }
    const start = read(0)
    const end = read(timing.duration - 0.01)
    const first = read(timing.duration * 0.2)
    const repeated = read(timing.duration * 1.2)
    const svg = target.closest('svg')
    results.push({
      scene: svg.dataset.scene,
      local: svg.classList.contains('local'),
      loops: timing.iterations === Infinity,
      seamless:
        (start.opacity === '0' && end.opacity === '0') ||
        (start.transform === end.transform && start.fill === end.fill),
      repeats: JSON.stringify(first) === JSON.stringify(repeated),
    })
  }
  const media = []
  let reduced
  try {
    // Activate the actual reduced-motion CSS rules; T3 cannot emulate this preference.
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule.type === CSSRule.MEDIA_RULE && rule.conditionText.includes('prefers-reduced-motion')) {
          media.push([rule, rule.media.mediaText])
          rule.media.mediaText = 'all'
        }
      }
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    reduced = {
      activeAnimations: document.getAnimations().filter((animation) => 'animationName' in animation).length,
      checkmark: getComputedStyle(document.querySelector('.draw')).strokeDashoffset,
      badgeVisible: getComputedStyle(document.querySelector('.badge')).opacity,
    }
  } finally {
    for (const [rule, original] of media) rule.media.mediaText = original
    for (const animation of document.getAnimations()) animation.play()
  }
  if (
    results.length !== 16 ||
    !results.every((result) => result.loops && result.seamless && result.repeats) ||
    !results.some((result) => result.local) ||
    reduced.activeAnimations !== 0 ||
    reduced.checkmark !== '0px' ||
    reduced.badgeVisible !== '1'
  ) throw new Error(JSON.stringify({ results, reduced }))
  return { passed: true, checkedAnimations: results.length, reduced }
}
