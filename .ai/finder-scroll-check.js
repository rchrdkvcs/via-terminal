/** Browser regression: run through the collaborative preview at 640 × 240 or larger. */
export async function setup(docked = false, transfers = 0) {
  const via = window.__via
  const { filesApi } = await import('/src/ipc/files.ts')
  filesApi.request = async () => ({
    owner: 'scroll-fixture',
    path: '/home/via',
    entries: Array.from({ length: 100 }, (_, i) => ({
      name: `file-${i}`,
      path: `/home/via/file-${i}`,
      kind: 'file',
      targetKind: null,
      size: 10,
      permissions: 0o100644,
      modified: null,
    })),
  })
  const id = docked ? 'scroll-docked' : 'scroll-tab'
  const tab = {
    kind: 'tab',
    id,
    title: 'Scroll fixture',
    target: { kind: 'quick', address: 'example.test', port: 22, username: 'via' },
    ...(!docked && { view: { kind: 'files', path: '/home/via' } }),
  }
  if (!via.spaces.spaceOf(id)) via.spaces.dispatch({ type: 'open', row: tab })
  via.workbench.activate(id, { wake: false })
  if (via.sessions.runtime(id).state === 'asleep') await via.sessions.start(tab, null)
  Object.assign(via.sessions.runtime(id), { state: 'ready', sessionId: 'scroll-fixture' })
  via.files.setVisible(id, true)
  await via.files.navigate(id, '/home/via')
  if (!via.files.transfers(id).length) {
    for (let i = 0; i < transfers; i++) {
      await via.files.startTransfer(id, {
        direction: 'download',
        source: `/home/via/file-${i}`,
        destination: `/tmp/file-${i}`,
        collision: 'overwrite',
      })
    }
  }
  for (let i = 0; i < 100; i++) {
    await new Promise(requestAnimationFrame)
    if (document.querySelector('section[aria-label="Explorateur distant"]')) return
  }
  throw new Error('Explorer did not mount')
}

export function check() {
  const panel = document.querySelector('section[aria-label="Explorateur distant"]')
  if (!panel) throw new Error('Explorer not mounted')
  const header = panel.querySelector('header')
  const list = panel.querySelector('[tabindex="-1"]')
  panel.scrollTop = 0
  list.scrollTop = 0
  const top = header.getBoundingClientRect().top
  list.scrollTop = 500
  const listScroll = list.scrollTop
  const transfers = panel.querySelector('section > ul')
  if (transfers) transfers.scrollTop = 500
  const transferScroll = transfers?.scrollTop ?? null
  // Exercise the outer scrollbar as well as the inner one.
  panel.scrollTop = 500
  const headerShift = header.getBoundingClientRect().top - top
  const result = {
    pass:
      panel.scrollTop === 0 &&
      headerShift === 0 &&
      listScroll > 0 &&
      (transferScroll === null || transferScroll > 0),
    outerScroll: panel.scrollTop,
    headerShift,
    listScroll,
    transferScroll,
    height: panel.clientHeight,
    contentHeight: panel.scrollHeight,
  }
  console.log(`${result.pass ? 'PASS' : 'FAIL'} finder scroll: ${JSON.stringify(result)}`)
  return result
}
