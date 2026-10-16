import { expect, test } from '@playwright/test'

test('open strings through the fake microphone: colors, red marker, yellow, stars', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Open strings' }).click()
  await expect(page.locator('.score svg')).toBeVisible()
  await expect(page.locator('.vt-hint').first()).toHaveText('G 0') // the preview already shows the first hint
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Stay quiet')).toBeVisible()
  await expect(page.getByText('Play the highlighted note')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.stars')).toBeVisible({ timeout: 30_000 })

  const notes = page.locator('.score .abcjs-note')
  await expect(notes).toHaveCount(8)
  const classes = await notes.evaluateAll((els) => els.map((e) => e.getAttribute('class') ?? ''))
  const color = (c: string) => (c.includes('vt-green') ? 'green' : c.includes('vt-yellow') ? 'yellow' : 'none')
  expect(classes.map(color)).toEqual(['green', 'green', 'green', 'green', 'green', 'green', 'green', 'yellow'])
  expect(classes.map((c) => c.includes('vt-missed'))).toEqual([false, false, false, false, false, true, false, false])
  // points: 6 greens * 2 + green-after-red 1 + yellow 1 = 14 of 16 = 87.5% -> 2 stars
  await expect(page.locator('.stars')).toHaveAttribute('aria-label', '2 of 3 stars')
  expect(errors).toEqual([])
})

/** Records every microphone track and AudioContext the page creates, so tests can check they are released. */
async function trackAudioResources(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __tracks: MediaStreamTrack[]; __contexts: AudioContext[] }
    w.__tracks = []
    w.__contexts = []
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints)
      w.__tracks.push(...stream.getTracks())
      return stream
    }
    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options)
        w.__contexts.push(this)
      }
    }
  })
}

test('leaving mid-exercise releases the microphone, and the next exercise can start', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await trackAudioResources(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open strings' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Stay quiet')).toBeVisible()
  await page.getByRole('button', { name: '← Exercises' }).click()

  const released = () =>
    page.evaluate(() => {
      const w = window as unknown as { __tracks: MediaStreamTrack[]; __contexts: AudioContext[] }
      return {
        tracks: w.__tracks.map((t) => t.readyState),
        contexts: w.__contexts.map((c) => c.state),
      }
    })
  await expect.poll(released).toEqual({ tracks: ['ended'], contexts: ['closed'] })

  await page.getByRole('button', { name: 'D major scale, one octave' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Play the highlighted note')).toBeVisible({ timeout: 10_000 })
  expect(errors).toEqual([])
})
