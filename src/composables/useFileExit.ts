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
  async function request() {
    if (pending) return
    pending = true
    try {
      for (;;) {
        const decision = await protection.protect(Object.keys(files.panels))
        if (!decision) return
        await Promise.all([spaces.flush(), settings.flush()])
        if (protection.current(decision)) break
      }
      closing = true
      // This listener already vetoes the native close. Calling close() again only
      // reaches destroy(), and destroying the last window is vetoed once more as
      // an exit with no code. app_exit(0) is the exit that veto lets through.
      await api.exit()
    } catch (cause) {
      closing = false
      notify.error(describeError(cause))
    } finally {
      pending = false
    }
  }
  const stopExit = on('app-exit-requested', () => {
    void request()
  })
  void getCurrentWindow()
    .onCloseRequested((event) => {
      if (closing) return
      event.preventDefault()
      void request()
    })
    .then((unlisten) => {
      stopped = unlisten
    })
  onBeforeUnmount(() => {
    stopped?.()
    stopExit()
  })
}
