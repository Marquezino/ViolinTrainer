import type { Locale } from './locales'

export const LOCALE_STORAGE_KEY = 'violin-trainer.locale'

export function loadSavedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Storage can be unavailable (private mode, blocked); the choice just isn't remembered.
  }
}
