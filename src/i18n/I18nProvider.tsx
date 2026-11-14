import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatters } from './format'
import { detectLocale, type Locale } from './locales'
import { MESSAGES, type Formatters, type Messages } from './messages'
import { loadSavedLocale, saveLocale } from './saved-locale'

interface I18n {
  locale: Locale
  t: Messages
  setLocale(locale: Locale): void
  /** Formatters for the current language; `preferFlats` comes from the exercise being shown. */
  format(preferFlats: boolean): Formatters
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    detectLocale(loadSavedLocale(), navigator.languages ?? []),
  )
  const t = MESSAGES[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t.appName
  }, [locale, t])

  const setLocale = useCallback((next: Locale) => {
    saveLocale(next)
    setLocaleState(next)
  }, [])

  const value = useMemo<I18n>(() => {
    const sharps = formatters(locale, t, false)
    const flats = formatters(locale, t, true)
    return { locale, t, setLocale, format: (preferFlats) => (preferFlats ? flats : sharps) }
  }, [locale, t, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext)
  if (!i18n) throw new Error('useI18n must be used inside I18nProvider')
  return i18n
}
