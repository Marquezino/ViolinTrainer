import { afterEach, describe, expect, test, vi } from 'vitest'
import { LOCALE_STORAGE_KEY, loadSavedLocale, saveLocale } from './saved-locale'

afterEach(() => vi.unstubAllGlobals())

describe('saved locale', () => {
  test('round-trips through localStorage', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    })
    expect(loadSavedLocale()).toBeNull()
    saveLocale('pt-BR')
    expect(data.get(LOCALE_STORAGE_KEY)).toBe('pt-BR')
    expect(loadSavedLocale()).toBe('pt-BR')
  })

  test('a throwing storage gives null and does not throw', () => {
    const boom = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom })
    expect(loadSavedLocale()).toBeNull()
    expect(() => saveLocale('en')).not.toThrow()
  })

  test('no localStorage at all gives null and does not throw', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(loadSavedLocale()).toBeNull()
    expect(() => saveLocale('en')).not.toThrow()
  })
})
