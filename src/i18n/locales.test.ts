import { describe, expect, test } from 'vitest'
import { detectLocale, isLocale, LOCALE_LABELS, LOCALES } from './locales'

describe('detectLocale', () => {
  test.each([
    [null, ['pt-BR'], 'pt-BR'],
    [null, ['pt'], 'pt-BR'],
    [null, ['pt-PT', 'en-US'], 'pt-BR'],
    [null, ['en-GB', 'pt-BR'], 'en'],
    [null, ['fr-FR', 'pt-BR'], 'pt-BR'],
    [null, ['fr-FR'], 'en'],
    [null, [], 'en'],
    ['pt-BR', ['en-US'], 'pt-BR'],
    ['en', ['pt-BR'], 'en'],
    ['xx', ['pt-BR'], 'pt-BR'],
    ['pt-PT', ['en-US'], 'en'],
  ])('saved %s, browser %j → %s', (saved, langs, expected) => {
    expect(detectLocale(saved, langs)).toBe(expected)
  })

  test('primary subtag is case-insensitive', () => {
    expect(detectLocale(null, ['PT-br'])).toBe('pt-BR')
  })
})

describe('isLocale', () => {
  test('accepts only known locales', () => {
    expect(LOCALES.every(isLocale)).toBe(true)
    expect(isLocale('pt')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })

  test('every locale has a label', () => {
    expect(LOCALE_LABELS['pt-BR']).toBe('Português (Brasil)')
    expect(LOCALE_LABELS.en).toBe('English')
  })
})
