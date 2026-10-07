import { formatShortcut, type ActionId } from '@/lib/shortcuts'
import { useSettings } from '@/stores/settings'

export function useShortcutLabel() {
  const settings = useSettings()
  return (id: ActionId) => formatShortcut(id, settings.platform)
}
