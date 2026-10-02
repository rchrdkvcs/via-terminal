import { formatShortcut, type ActionId } from '@/lib/shortcuts'
import { useSettings } from '@/stores/settings'

/** Shortcut hints as the user's platform writes them. */
export function useShortcutLabel() {
  const settings = useSettings()
  return (id: ActionId) => formatShortcut(id, settings.platform)
}
