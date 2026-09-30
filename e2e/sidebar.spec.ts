import { expect, test } from '@playwright/test'
import { seedWorkspace } from './workspace-fixture'

test('hidden sidebar has a generous edge target and a detached overlay', async ({ page }) => {
  await page.goto('/')

  await page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__: {
        config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } }
      }
    }
    const store = app.__vue_app__.config.globalProperties.$pinia._s.get('app') as {
      sidebarPinned: boolean
      sidebarPeek: boolean
      preferences: { sidebarRevealDelay: number }
    }
    store.sidebarPinned = false
    store.sidebarPeek = false
    store.preferences.sidebarRevealDelay = 100
  })

  const zone = page.locator('[data-sidebar-peek-zone]')
  await expect(zone).toBeVisible()
  await expect(zone).toHaveCSS('width', '32px')

  const zoneBox = await zone.boundingBox()
  if (!zoneBox) throw new Error('sidebar peek zone is not visible')
  await page.mouse.move(12, zoneBox.y + zoneBox.height / 2)

  const panel = page.locator('[data-sidebar-peek-panel]')
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('transform', 'none')

  await page.mouse.move(500, zoneBox.y + zoneBox.height / 2)
  await page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__: {
        config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } }
      }
    }
    const store = app.__vue_app__.config.globalProperties.$pinia._s.get('app') as {
      sidebarPeek: boolean
    }
    store.sidebarPeek = false
  })
  await expect(panel).toBeHidden()
  await page.mouse.move(28, zoneBox.y + zoneBox.height / 2)
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('transform', 'none')

  // The parent slide transition can still be running when the inner panel's
  // transform is already none. Wait for its final physical position.
  await expect.poll(async () => (await panel.boundingBox())?.x).toBeCloseTo(4, 0)
  const panelBox = await panel.boundingBox()
  if (!panelBox) throw new Error('sidebar peek panel is not visible')

  expect(panelBox.x).toBeCloseTo(4, 0)
  // The existing overlay extends 4 px above the workspace surface.
  expect(panelBox.y - zoneBox.y).toBeCloseTo(-4, 0)
  expect(zoneBox.y + zoneBox.height - (panelBox.y + panelBox.height)).toBeCloseTo(4, 0)
})

test('sidebar peek removes movement when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(() => {
    const app = document.querySelector('#app') as HTMLElement & {
      __vue_app__: {
        config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } }
      }
    }
    const store = app.__vue_app__.config.globalProperties.$pinia._s.get('app') as {
      sidebarPinned: boolean
      preferences: { sidebarRevealDelay: number }
    }
    store.sidebarPinned = false
    store.preferences.sidebarRevealDelay = 0
  })

  await page.mouse.move(12, 200)
  const panel = page.locator('[data-sidebar-peek-panel]')
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('transform', 'none')
})

test('tab drag keeps stable identities when reordering and splitting', async ({ page }) => {
  await page.goto('/')
  await seedWorkspace(page)
  for (let index = 0; index < 3; index++) {
    await page
      .getByRole('button', { name: /Nouvel onglet/ })
      .first()
      .click()
    await page.getByRole('dialog').getByRole('button', { name: /Bash/ }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }

  const state = () =>
    page.evaluate(() => {
      const app = document.querySelector('#app') as HTMLElement & {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } }
        }
      }
      const store = app.__vue_app__.config.globalProperties.$pinia._s.get('app') as {
        tabs: Array<{ id: string; position: number }>
        splitGroups: Array<{ tabIds: string[] }>
      }
      return {
        ids: store.tabs.map((tab) => tab.id),
        order: [...store.tabs].sort((a, b) => a.position - b.position).map((tab) => tab.id),
        groups: store.splitGroups.map((group) => [...group.tabIds]),
      }
    })

  const before = await state()
  expect(new Set(before.ids).size).toBe(3)

  const rows = page.locator('[data-tab-id]')
  await rows.nth(2).dragTo(rows.nth(0))
  await expect.poll(async () => (await state()).order.join(',')).not.toBe(before.order.join(','))

  const reordered = await state()
  expect(new Set(reordered.ids)).toEqual(new Set(before.ids))

  const source = page.locator(`[data-tab-id="${reordered.order[2]}"]`)
  const target = page.locator(`[data-tab-id="${reordered.order[0]}"]`)
  // A row leaving its previous area remains in the DOM during the transition.
  await expect(source).toHaveCount(1)
  await expect(target).toHaveCount(1)
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('tab rows are not visible')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 8, sourceBox.y + sourceBox.height / 2)
  await page.mouse.move(targetBox.x + targetBox.width - 2, targetBox.y + targetBox.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  await expect.poll(async () => (await state()).groups.length).toBe(1)
  const split = await state()
  expect(new Set(split.ids)).toEqual(new Set(before.ids))
  expect(split.groups[0]).toHaveLength(2)
})
