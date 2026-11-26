import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { addProfile, storedAttempts } from './helpers.ts'

/** Today's practice time on the path, as shown next to the goal ring ("0:07 of 10 min"). */
const todayTime = (page: Page) => page.locator('.goal-time')

async function playOpenStringsToTheEnd(page: Page) {
  await page.getByRole('button', { name: 'Open strings' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.stars')).toHaveAttribute('aria-label', '2 of 3 stars', { timeout: 30_000 })
}

async function expectOpenStringsDone(page: Page) {
  await expect(page.getByRole('button', { name: 'Open strings' })).toContainText('★★☆')
  await expect(page.getByRole('button', { name: 'A string: fingers 0 to 3' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'D major scale, one octave' })).toBeDisabled()
  await expect(todayTime(page)).not.toHaveText(/^0:00/)
}

test('first visit shows the empty picker and adding a player opens their path', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Who's practising?" })).toBeVisible()
  await page.getByRole('button', { name: 'Add the first player' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('textbox', { name: 'New player name' }).fill('Player A')
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Player A' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Player A' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'First steps' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open strings' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'A string: fingers 0 to 3' })).toBeDisabled()
  await expect(todayTime(page)).toHaveText('0:00 of 10 min')
  expect(errors).toEqual([])
})

test('a finished run saves stars, unlocks the next exercise and survives a reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await addProfile(page, 'Player A')
  await playOpenStringsToTheEnd(page)
  await expect(page.getByText('New best: 2 stars!')).toBeVisible()
  await expect(page.getByText(/^Today: \d+:\d\d of 10 min$/)).toBeVisible()
  await page.getByRole('button', { name: 'Back to path' }).click()
  await expectOpenStringsDone(page)

  await page.reload()
  await page.getByRole('button', { name: 'Player A' }).click()
  await expectOpenStringsDone(page)
  expect(errors).toEqual([])
})

test('leaving mid-run still counts minutes', async ({ page }) => {
  await addProfile(page, 'Player A')
  await page.getByRole('button', { name: 'Open strings' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect.poll(() => page.locator('.score .vt-green').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: '← Path' }).click()
  await expect(todayTime(page)).not.toHaveText(/^0:00/)
  // An unfinished run earns no stars and unlocks nothing.
  await expect(page.getByRole('button', { name: 'Open strings' })).toContainText('☆☆☆')
  await expect(page.getByRole('button', { name: 'A string: fingers 0 to 3' })).toBeDisabled()
  await expect
    .poll(async () => (await storedAttempts(page)).map((a) => ({ completed: a.completed, played: a.activeMs > 0 })))
    .toEqual([{ completed: false, played: true }])
})

test('"Play again" saves the finished run and starts a new one', async ({ page }) => {
  await addProfile(page, 'Player A')
  await playOpenStringsToTheEnd(page)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByText('Play the highlighted note')).toBeVisible({ timeout: 10_000 })
  await expect.poll(() => page.locator('.score .vt-green').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: '← Path' }).click()
  await expect
    .poll(async () => (await storedAttempts(page)).map((a) => a.completed).sort())
    .toEqual([false, true])
  await expect(page.getByRole('button', { name: 'Open strings' })).toContainText('★★☆')
})

test('settings: goal and tolerances are saved per profile', async ({ page }) => {
  await addProfile(page, 'Player A')
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('textbox', { name: 'New player name' }).fill('Player B')
  await page.getByRole('button', { name: 'Add player' }).click()

  const a = page.getByRole('group', { name: 'Player A' })
  await a.getByRole('combobox', { name: 'Daily goal (minutes)' }).selectOption('15')
  await a.getByRole('spinbutton', { name: 'Green (cents)' }).fill('10')
  await a.getByRole('spinbutton', { name: 'Yellow (cents)' }).fill('5')
  await a.getByRole('button', { name: 'Save' }).click()
  await expect(a.getByRole('alert')).toHaveText('The yellow tolerance must not be smaller than the green tolerance.')
  await a.getByRole('spinbutton', { name: 'Yellow (cents)' }).fill('25')
  await a.getByRole('button', { name: 'Save' }).click()
  await expect(a.getByText('Saved.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  const a2 = page.getByRole('group', { name: 'Player A' })
  await expect(a2.getByRole('combobox', { name: 'Daily goal (minutes)' })).toHaveValue('15')
  await expect(a2.getByRole('spinbutton', { name: 'Green (cents)' })).toHaveValue('10')
  await expect(a2.getByRole('spinbutton', { name: 'Yellow (cents)' })).toHaveValue('25')
  const b = page.getByRole('group', { name: 'Player B' })
  await expect(b.getByRole('combobox', { name: 'Daily goal (minutes)' })).toHaveValue('10')
  await expect(b.getByRole('spinbutton', { name: 'Green (cents)' })).toHaveValue('20')
  await expect(b.getByRole('spinbutton', { name: 'Yellow (cents)' })).toHaveValue('35')

  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Player A' }).click()
  await expect(todayTime(page)).toHaveText('0:00 of 15 min')
})

test('backup export downloads a file, and importing it back restores the data', async ({ page }) => {
  await addProfile(page, 'Player A')
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()

  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await exported
  expect(download.suggestedFilename()).toMatch(/^violin-trainer-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await download.path()
  expect(JSON.parse(readFileSync(file, 'utf8')).format).toBe('violin-trainer-backup')

  // A file that is not a backup is refused, and nothing changes.
  const input = page.getByLabel('Import backup')
  await input.setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(page.getByText('This file is not a Violin Trainer backup.')).toBeVisible()

  const a = page.getByRole('group', { name: 'Player A' })
  await a.getByRole('button', { name: 'Delete player' }).click()
  await a.getByRole('button', { name: 'Yes, delete' }).click()
  await expect(a).toHaveCount(0)

  await input.setInputFiles(file)
  await expect(page.getByText('This backup has 1 player and 0 runs.', { exact: false })).toBeVisible()
  const safetyCopy = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Replace my data' }).click()
  await safetyCopy
  await expect(page.getByText('Backup restored.')).toBeVisible()
  await page.getByRole('button', { name: '← Players' }).click()
  await expect(page.getByRole('button', { name: 'Player A' })).toBeVisible()
})

test('after importing a backup over the same player, settings show and keep the restored values', async ({ page }) => {
  await addProfile(page, 'Player A')
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()

  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await (await exported).path()

  const a = page.getByRole('group', { name: 'Player A' })
  await a.getByRole('textbox', { name: 'Name' }).fill('Player Z')
  await a.getByRole('combobox', { name: 'Daily goal (minutes)' }).selectOption('30')
  await a.getByRole('button', { name: 'Save' }).click()
  // The legend follows the saved name.
  await expect(page.getByRole('group', { name: 'Player Z' }).getByText('Saved.')).toBeVisible()

  await page.getByLabel('Import backup').setInputFiles(file)
  const safetyCopy = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Replace my data' }).click()
  await safetyCopy
  await expect(page.getByText('Backup restored.')).toBeVisible()

  const restored = page.getByRole('group', { name: 'Player A' })
  await expect(restored.getByRole('textbox', { name: 'Name' })).toHaveValue('Player A')
  await expect(restored.getByRole('combobox', { name: 'Daily goal (minutes)' })).toHaveValue('10')
  await restored.getByRole('button', { name: 'Save' }).click()
  await expect(restored.getByText('Saved.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  const reloaded = page.getByRole('group', { name: 'Player A' })
  await expect(reloaded.getByRole('textbox', { name: 'Name' })).toHaveValue('Player A')
  await expect(reloaded.getByRole('combobox', { name: 'Daily goal (minutes)' })).toHaveValue('10')
})
