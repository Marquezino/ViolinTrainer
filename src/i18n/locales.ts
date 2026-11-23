export const LOCALES = ['en', 'pt-BR'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
}

// Primary language subtag of the browser language -> the locale we offer for it.
const LOCALE_BY_PRIMARY_SUBTAG: Record<string, Locale> = {
  en: 'en',
  pt: 'pt-BR',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** A saved choice wins; otherwise the first browser language we support; otherwise English. */
export function detectLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (isLocale(saved)) return saved
  for (const language of browserLanguages) {
    const primary = language.split('-')[0].toLowerCase()
    const locale = LOCALE_BY_PRIMARY_SUBTAG[primary]
    if (locale) return locale
  }
  return 'en'
}
