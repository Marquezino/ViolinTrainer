import { expect, test } from '@playwright/test'

test('switching to Portuguese translates the app and is remembered', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await expect(page.getByRole('heading', { name: 'Exercícios' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cordas soltas' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Exercícios' })).toBeVisible()
  await page.getByRole('button', { name: 'Corda Lá: dedos 0 a 3' }).click()
  await expect(page.getByRole('heading', { name: 'Corda Lá: dedos 0 a 3' })).toBeVisible()
  await expect(page.locator('.vt-hint').first()).toHaveText('Lá 0')
  await expect(page.getByRole('button', { name: 'Começar' })).toBeVisible()
})

test('typed ABC survives a language switch and its problems are translated', async ({ page }) => {
  await page.goto('/')
  const box = page.getByRole('textbox', { name: 'ABC notation' })
  await box.fill('X:1\nK:D\nA [GB] |]')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await expect(page.locator('textarea')).toHaveValue('X:1\nK:D\nA [GB] |]')
  await expect(page.getByRole('alert')).not.toContainText('Chords')
  // The textbox's accessible name is translated now, so find it by tag.
  await page.locator('textarea').fill('X:1\nK:D\nA B |]') // no T: line
  await page.getByRole('button', { name: 'Praticar este' }).click()
  await expect(page.getByRole('heading', { name: 'Sem título' })).toBeVisible()
})

test.describe('Portuguese browser', () => {
  test.use({ locale: 'pt-BR' })
  test('picks Portuguese on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Exercícios' })).toBeVisible()
  })
})
