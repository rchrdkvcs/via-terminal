import { watch } from 'vue'
import { useAppStore } from '@/stores/app'

/**
 * Keeps `<html>` in sync with the resolved appearance and density.
 *
 * A theme flip repaints colour, background, border and shadow on nearly every
 * element at once. Suppressing transitions for one frame makes the switch snap
 * instead of smearing.
 */
export function useAppearance() {
  const store = useAppStore()

  function suppressTransitions() {
    const style = document.createElement('style')
    style.textContent = '*,*::before,*::after{transition:none !important}'
    document.head.appendChild(style)
    // Force a reflow so the rule applies before the class change is painted.
    void document.body.offsetHeight
    requestAnimationFrame(() => style.remove())
  }

  watch(
    () => store.appearance,
    (appearance, previous) => {
      if (previous) suppressTransitions()
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      document.documentElement.style.colorScheme = appearance
      store.applyPresentation()
    },
    { immediate: true },
  )

  watch(
    () => store.settings.density,
    (density) => {
      document.documentElement.dataset.density = density
    },
    { immediate: true },
  )

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', (event) => {
      store.updatePreferences({ systemPrefersDark: event.matches })
    })
  }
}
