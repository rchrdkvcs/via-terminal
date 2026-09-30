import type { Page } from '@playwright/test'
import type { AppData } from '../src/ipc/types'
import type { useAppStore } from '../src/stores/app'

/** Browser tests exercise the UI with a deterministic native boundary.
 * This does not exercise real SSH authentication. */
export async function seedWorkspace(page: Page, withSsh = false) {
  await page.evaluate((withSsh) => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__: {
        config: {
          globalProperties: { $pinia: { _s: Map<string, ReturnType<typeof useAppStore>> } }
        }
      }
    }
    const store = app.__vue_app__.config.globalProperties.$pinia._s.get('app')!
    const data: AppData = {
      workspaces: [
        {
          id: 'workspace',
          name: 'Personnel',
          icon: 'terminal',
          color: '#777777',
          position: 0,
          defaultProfileId: 'profile',
        },
      ],
      profiles: [
        {
          id: 'profile',
          workspaceId: 'workspace',
          name: 'Bash',
          executable: '/bin/bash',
          args: [],
          workingDirectory: null,
        },
      ],
      resources: withSsh
        ? [
            {
              id: 'host',
              workspaceId: 'workspace',
              name: 'Production',
              host: 'example.test',
              sshAlias: null,
              port: 22,
              identityId: 'identity',
            },
          ]
        : [],
      identities: withSsh
        ? [
            {
              id: 'identity',
              workspaceId: 'workspace',
              name: 'Admin',
              username: 'admin',
              identityFile: null,
            },
          ]
        : [],
      sidebarNodes: withSsh
        ? [
            {
              id: 'node',
              workspaceId: 'workspace',
              parentId: null,
              kind: 'resource',
              label: 'Production',
              targetId: 'host',
              position: 0,
            },
          ]
        : [],
      tabs: [],
      savedSessions: [],
      favorites: [],
      splitGroups: [],
      windows: [],
      settings: JSON.parse(JSON.stringify(store.settings)),
      appState: { cleanShutdown: true, recoveryAvailable: false },
    }
    store.applySnapshot(data)
    let next = 0
    const nativeWindow = window as unknown as {
      __TAURI_INTERNALS__: {
        transformCallback: () => number
        invoke: (command: string) => Promise<unknown>
      }
    }
    nativeWindow.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (command) => {
        if (command === 'session_spawn') return { id: `session-${++next}` }
        if (command === 'ssh_session_connect')
          return {
            sessionId: `session-${++next}`,
            resolved: {
              destination: 'example.test',
              host: 'example.test',
              user: 'admin',
              port: 22,
              identityFiles: [],
            },
          }
        if (command === 'app_snapshot') return structuredClone(data)
        if (command === 'ssh_config_list') return []
        return null
      },
    }
  }, withSsh)
}

export async function tabIds(page: Page) {
  return page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__: {
        config: {
          globalProperties: { $pinia: { _s: Map<string, ReturnType<typeof useAppStore>> } }
        }
      }
    }
    return app.__vue_app__.config.globalProperties.$pinia._s.get('app')!.tabs.map((tab) => tab.id)
  })
}
