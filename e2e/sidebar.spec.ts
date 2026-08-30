import { expect, test } from '@playwright/test'

test('tab drag keeps stable identities when reordering and splitting', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Nouveau terminal').click()
  await page.getByText('Nouveau terminal').click()
  await page.getByText('Nouveau terminal').click()

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
