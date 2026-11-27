import { expect, type Page } from '@playwright/test'

/**
 * Goes to the picker, adds a player through settings, then opens that player's path. Unless
 * `skipTuning` is false, the player skips the tuning screen, so "Open strings" goes straight to practice.
 */
export async function addProfile(page: Page, name: string, options: { skipTuning?: boolean } = {}): Promise<void> {
  const { skipTuning = true } = options
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('textbox', { name: 'New player name' }).fill(name)
  await page.getByRole('button', { name: 'Add player' }).click()
  const form = page.getByRole('group', { name })
  await expect(form).toBeVisible()
  if (skipTuning) {
    await form.getByRole('checkbox', { name: 'Skip the tuning screen' }).check()
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(form.getByText('Saved.')).toBeVisible()
  }
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** Every stored attempt, read straight from IndexedDB. */
export async function storedAttempts(page: Page): Promise<{ completed: boolean; activeMs: number; stars: number; finishedAt: number | null }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('violin-trainer')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const request = db.transaction('attempts').objectStore('attempts').getAll()
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            db.close()
            resolve(request.result)
          }
        }
      }),
  )
}
