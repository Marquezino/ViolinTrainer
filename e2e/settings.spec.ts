import { expect, test } from '@playwright/test'
import { addProfile } from './helpers.ts'

const GREEN_HINT = 'Notes within this many cents of the right pitch count as in tune and turn green.'

test('the green tolerance help opens on click and on hover, and closes on Escape', async ({ page }) => {
  await addProfile(page, 'Player A', { skipTuning: false })
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  const form = page.getByRole('group', { name: 'Player A' })
  const help = form.getByRole('button', { name: 'Help: Green (cents)' })
  const tip = form.getByRole('tooltip')
  await expect(tip).toBeHidden()
  await expect(help).toHaveAttribute('aria-expanded', 'false')
  // The text is the button's description, for screen readers.
  await expect(help).toHaveAccessibleDescription(GREEN_HINT)

  await help.click()
  await expect(tip).toBeVisible()
  await expect(tip).toHaveText(GREEN_HINT)
  await expect(help).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()

  await page.mouse.move(0, 0)
  await help.blur()
  await help.hover()
  await expect(tip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
})

test('a help tip opened by a tap closes on a tap outside and stays on a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  const help = page.getByRole('button', { name: 'Help: A4 (Hz)' })
  const box = await help.boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(48)
  expect(box!.height).toBeGreaterThanOrEqual(48)
  await help.click()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  const tipBox = await tip.boundingBox()
  expect(tipBox!.x).toBeGreaterThanOrEqual(0)
  expect(tipBox!.x + tipBox!.width).toBeLessThanOrEqual(360)
  await page.getByRole('heading', { name: 'Settings' }).click()
  await expect(tip).toBeHidden()
})

test('deleting all data needs the typed word, then the app starts fresh', async ({ page }) => {
  await addProfile(page, 'Player A')
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  const section = page.getByRole('region', { name: 'Delete all data' })
  await expect(section).toContainText('cannot be undone')
  const download = page.waitForEvent('download')
  await section.getByRole('button', { name: 'Export a backup first' }).click()
  expect((await download).suggestedFilename()).toMatch(/^violin-trainer-backup-.*\.json$/)

  // Cancel goes back without deleting.
  await section.getByRole('button', { name: 'Delete all data…' }).click()
  await section.getByRole('button', { name: 'Cancel' }).click()
  await expect(section.getByRole('button', { name: 'Delete all data…' })).toBeVisible()

  await section.getByRole('button', { name: 'Delete all data…' }).click()
  const confirm = section.getByRole('button', { name: 'Delete everything' })
  const word = section.getByRole('textbox', { name: 'Type DELETE to confirm' })
  await expect(confirm).toBeDisabled()
  await word.fill('DELET')
  await expect(confirm).toBeDisabled()
  await word.fill('DELETE')
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect(page.getByRole('button', { name: 'Add the first player' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Player A' })).toHaveCount(0)
  // The built-in units are back for a new player.
  await addProfile(page, 'Player B')
  await expect(page.getByRole('button', { name: 'Open strings' })).toBeEnabled()
})

test('in Portuguese the word is APAGAR, and the saved language is deleted too', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await page.getByRole('button', { name: 'Configurações' }).click()
  const section = page.getByRole('region', { name: 'Apagar todos os dados' })
  await section.getByRole('button', { name: 'Apagar todos os dados…' }).click()
  const confirm = section.getByRole('button', { name: 'Apagar tudo' })
  await section.getByRole('textbox', { name: 'Digite APAGAR para confirmar' }).fill('APAGAR')
  await confirm.click()
  // The browser is English: with the saved choice gone, the app opens in English again.
  await expect(page.getByRole('heading', { name: "Who's practising?" })).toBeVisible()
})
