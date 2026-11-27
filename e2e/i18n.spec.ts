import { expect, test } from '@playwright/test'
import { addProfile } from './helpers.ts'

test('switching to Portuguese on the path translates the app and is remembered', async ({ page }) => {
  await addProfile(page, 'Player A')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await expect(page.getByRole('heading', { name: 'Primeiros passos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cordas soltas' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Quem vai praticar?' })).toBeVisible()
  await page.getByRole('button', { name: 'Player A' }).click()
  await expect(page.getByRole('heading', { name: 'Primeiros passos' })).toBeVisible()
  await page.getByRole('button', { name: 'Cordas soltas' }).click()
  await expect(page.getByRole('heading', { name: 'Cordas soltas' })).toBeVisible()
  await expect(page.locator('.vt-hint').first()).toHaveText('Sol 0')
  await expect(page.getByText('fique em silêncio por dois segundos')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Começar' })).toBeVisible()
})

test('the language is saved on the profile', async ({ page }) => {
  await addProfile(page, 'Player A')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await page.getByRole('button', { name: '← Jogadores' }).click()
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('textbox', { name: 'Nome do novo jogador' }).fill('Player B')
  await page.getByRole('button', { name: 'Adicionar jogador' }).click()
  await page.getByRole('button', { name: '← Jogadores' }).click()
  // Player B was created in Portuguese too; switching it to English leaves Player A in Portuguese.
  await page.getByRole('button', { name: 'Player B' }).click()
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en')
  await page.getByRole('button', { name: '← Players' }).click()
  await page.getByRole('button', { name: 'Player A' }).click()
  await expect(page.getByRole('heading', { name: 'Primeiros passos' })).toBeVisible()
})

test('typed ABC survives a language switch and its problems are translated', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Try your own ABC' }).click()
  const box = page.getByRole('textbox', { name: 'ABC notation' })
  await box.fill('X:1\nK:D\nA [GB] |]')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await expect(page.locator('textarea')).toHaveValue('X:1\nK:D\nA [GB] |]')
  await expect(page.getByRole('alert')).not.toContainText('Chords')
  await expect(page.getByRole('alert')).toContainText('Acordes')
  // The textbox's accessible name is translated now, so find it by tag.
  await page.locator('textarea').fill('X:1\nK:D\nA B |]') // no T: line
  await page.getByRole('button', { name: 'Praticar este' }).click()
  await expect(page.getByRole('heading', { name: 'Sem título' })).toBeVisible()
})

test('the first screen has a language menu, and the choice survives a reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Who's practising?" })).toBeVisible()
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await expect(page.getByRole('heading', { name: 'Quem vai praticar?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar o primeiro jogador' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Quem vai praticar?' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR')
})

test('settings has a language menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Quem vai praticar?' })).toBeVisible()
})

test.describe('Portuguese browser', () => {
  test.use({ locale: 'pt-BR' })
  test('picks Portuguese on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Quem vai praticar?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Adicionar o primeiro jogador' })).toBeVisible()
  })
})
