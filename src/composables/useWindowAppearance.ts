import { useEventListener } from '@vueuse/core'
import { watch } from 'vue'
import { useSettings } from '@/stores/settings'

export function useWindowAppearance() {
  const settings = useSettings()
  const root = document.documentElement

  watch(
    () => settings.appearance,
    (appearance) => {
      const freeze = document.createElement('style')
      freeze.textContent = '*,*::before,*::after{transition:none !important}'
      document.head.appendChild(freeze)
      root.classList.toggle('dark', appearance === 'dark')
      void root.offsetHeight
      requestAnimationFrame(() => freeze.remove())
    },
    { immediate: true },
  )

  useEventListener(window, 'blur', () => root.toggleAttribute('data-inactive', true))
  useEventListener(window, 'focus', () => root.toggleAttribute('data-inactive', false))
}
