import { expect, test } from '@playwright/test'
import { seedWorkspace, tabIds } from './workspace-fixture'

test('new tab chooses a local profile or saved SSH host, without changing existing tabs', async ({
  page,
}) => {
  await page.goto('/')
  await seedWorkspace(page, true)
  const dialog = page.getByRole('dialog')

  await page.keyboard.press('Control+t')
  await expect(dialog.getByRole('tab', { name: 'Terminal local' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await tabIds(page)).toHaveLength(0)

  await page
    .getByRole('button', { name: /Nouvel onglet/ })
    .first()
    .click()
  await dialog.getByRole('button', { name: /Bash/ }).click()
  await expect(dialog).toHaveCount(0)
  const local = await tabIds(page)
  expect(local).toHaveLength(1)

  await page.keyboard.press('Control+t')
  await dialog.getByRole('tab', { name: 'SSH', exact: true }).click()
  await dialog.getByRole('button', { name: 'Modifier Production' }).click()
  await expect(dialog.getByRole('heading', { name: 'Modifier la connexion SSH' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog.getByRole('tab', { name: 'SSH', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(await tabIds(page)).toEqual(local)

  await dialog.getByRole('button', { name: 'Ouvrir', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const opened = await tabIds(page)
  expect(opened).toHaveLength(2)
  expect(opened).toContain(local[0])
})

test('SSH creation belongs to New Tab and is absent from settings', async ({ page }) => {
  await page.goto('/')
  await seedWorkspace(page)
  await page.getByRole('button', { name: 'Réglages', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Sections des réglages' })).not.toContainText(
    'SSH',
  )
  await page.keyboard.press('Control+t')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'SSH', exact: true }).click()
  await expect(dialog.getByText('Aucune connexion SSH')).toBeVisible()
  await dialog.getByRole('button', { name: 'Ajouter une connexion' }).click()
  await expect(dialog.getByRole('heading', { name: 'Nouvelle connexion SSH' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('heading', { name: 'Nouvel onglet' })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await tabIds(page)).toHaveLength(0)
})
