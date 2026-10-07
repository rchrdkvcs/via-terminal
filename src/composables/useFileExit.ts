import { onBeforeUnmount } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { api, describeError, isNative } from '@/ipc/client'
import { on } from '@/ipc/events'
import { notify } from '@/lib/notify'
import { useFiles } from '@/stores/files'
import { useSpaces } from '@/stores/spaces'
import { useSettings } from '@/stores/settings'
import { useFileProtection } from './useFileProtection'
export function useFileExit() {
  if (!isNative()) return
  const files = useFiles(),
    spaces = useSpaces(),
    settings = useSettings(),
    protection = useFileProtection()
  let stopped: (() => void) | undefined,
    closing = false,
    pending = false
  async function request(exit: boolean) {
    if (pending) return
    pending = true
    try {
      if (!(await protection.protect(Object.keys(files.panels)))) return
      await Promise.all([spaces.flush(), settings.flush()])
      closing = true
      if (exit) await api.exit()
      else await getCurrentWindow().close()
    } catch (cause) {
      closing = false
      notify.error(describeError(cause))
    } finally {
      pending = false
    }
  }
  const stopExit = on('app-exit-requested', () => {
    void request(true)
  })
  void getCurrentWindow()
    .onCloseRequested((event) => {
      if (closing) return
      event.preventDefault()
      void request(false)
    })
    .then((unlisten) => {
      stopped = unlisten
    })
  onBeforeUnmount(() => {
    stopped?.()
    stopExit()
  })
}
