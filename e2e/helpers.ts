import { expect, type Page } from '@playwright/test'

/** Goes to the picker, adds a player through settings, then opens that player's path. */
export async function addProfile(page: Page, name: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('textbox', { name: 'New player name' }).fill(name)
  await page.getByRole('button', { name: 'Add player' }).click()
  await expect(page.getByRole('group', { name })).toBeVisible()
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** Every stored attempt, read straight from IndexedDB. */
export async function storedAttempts(page: Page): Promise<{ completed: boolean; activeMs: number; stars: number }[]> {
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
