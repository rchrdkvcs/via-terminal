/** Sanitized browser fixture: UI gestures only; real SSH/SFTP is tested in Rust. */
const home = '/home/via'
const entry = (name, kind, size, permissions, extra = {}) => ({
  name,
  path: `${home}/${name}`,
  kind,
  size,
  permissions,
  modified: 0,
  ...extra,
})
const entries = [
  entry('.profile', 'file', 807, 0o100644),
  entry('config.json', 'file', 50, 0o100644),
  entry('deploy-production-release-candidate-with-a-long-name.sh', 'file', 18_432, 0o100755),
  entry('current', 'link', 0, 0o120777, { targetKind: 'directory' }),
  entry('logs', 'directory', 0, 0o40755),
  entry('archive.tar.gz', 'file', 7_340_032, 0o100600),
]
export async function setup() {
  const via = window.__via
  const id = 'visual-sftp'
  if (!via.spaces.spaceOf(id)) via.spaces.dispatch({ type: 'open', row: { kind: 'tab', id, title: 'Serveur de test', target: { kind: 'quick', address: 'example.test', port: 22, username: 'via' } } })
  via.workbench.activate(id, { wake: false })
  if (via.sessions.runtime(id).state === 'asleep') await via.sessions.start(via.workbench.activeTab, null)
  Object.assign(via.sessions.runtime(id), { sessionId: 'visual-session', state: 'ready' })
  const { filesApi } = await import('/src/ipc/files.ts')
  filesApi.request = async (_, request) => {
    if (request.operation === 'list') {
      const path = request.path === '.' ? home : request.path
      if (path.endsWith('/denied')) throw { code: 'sftp', message: 'Permission refusée.' }
      return { owner: 'fixture', path, entries: path === home ? entries : [] }
    }
    if (request.operation === 'read') return { owner: 'fixture', path: request.path, resolvedPath: request.path, content: JSON.stringify({ environment: 'development', port: 8080 }, null, 2) + '\n', permissions: 33188, uid: 1000, gid: 1000 }
    if (request.operation === 'save') return request.document
    return null
  }
  return id
}
/** Adds sanitized documents, a save conflict and transfers in every state to the open explorer. */
export async function seed(id = 'visual-sftp') {
  const { useFiles } = await import('/src/stores/files.ts')
  const files = useFiles()
  const panel = files.state(id)
  panel.visible = true
  await files.openDocument(id, 'visual-session', `${home}/config.json`)
  await files.openDocument(id, 'visual-session', `${home}/deploy-production-release-candidate-with-a-long-name.sh`)
  const [first, second] = panel.documents
  first.content += '// edited\n'
  Object.assign(second, { content: second.content + '#', error: 'Le fichier distant a changé depuis son ouverture.', conflict: true })
  const transfer = (state, name, extra = {}) => ({ sessionId: 'visual-session', id: `t-${state}`, state, direction: 'upload', path: `${home}/${name}`, bytes: 0, total: 0, message: null, skipped: [], retryable: false, ...extra })
  panel.transfers = [
    transfer('running', 'archive.tar.gz', { bytes: 3_145_728, total: 7_340_032 }),
    transfer('preparing', 'photos', { bytes: 524_288, total: 2_097_152 }),
    transfer('failed', 'logs', { direction: 'download', message: 'Connexion interrompue. Vous pouvez réessayer après reconnexion.', retryable: true }),
    transfer('completed', 'site', { skipped: [`${home}/site/latest`] }),
    transfer('cancelled', 'backup.sql'),
  ]
  return panel.documents.length
}
