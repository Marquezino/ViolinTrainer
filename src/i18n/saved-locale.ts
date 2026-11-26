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

/** Forgets the saved choice, so the next visit picks the language from the browser again. */
export function clearSavedLocale(): void {
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY)
  } catch {
    // Nothing saved that can be reached.
  }
}
