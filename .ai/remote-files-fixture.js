/** Sanitized browser fixture: UI gestures only; real SSH/SFTP is tested in Rust. */
export async function setup() {
  const via = window.__via
  const id = 'visual-sftp'
  if (!via.spaces.spaceOf(id)) via.spaces.dispatch({ type: 'open', row: { kind: 'tab', id, title: 'Serveur de test', target: { kind: 'quick', address: 'example.test', port: 22, username: 'via' } } })
  via.workbench.activate(id, { wake: false })
  if (via.sessions.runtime(id).state === 'asleep') await via.sessions.start(via.workbench.activeTab, null)
  Object.assign(via.sessions.runtime(id), { sessionId: 'visual-session', state: 'ready' })
  const { filesApi } = await import('/src/ipc/files.ts')
  filesApi.request = async (_, request) => {
    if (request.operation === 'list') return { path: request.path === '.' ? '/home/via' : request.path, entries: [
      { name: 'config.json', path: '/home/via/config.json', kind: 'file', size: 50, permissions: 33188, modified: 0 },
      { name: 'logs', path: '/home/via/logs', kind: 'directory', size: 0, permissions: 16877, modified: 0 },
    ] }
    if (request.operation === 'read') return { path: request.path, resolvedPath: request.path, content: JSON.stringify({ environment: 'development', port: 8080 }, null, 2) + '\n', permissions: 33188, uid: 1000, gid: 1000 }
    if (request.operation === 'save') return request.document
    return null
  }
  return id
}
