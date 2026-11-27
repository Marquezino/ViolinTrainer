import { useI18n } from '../i18n/I18nProvider'
import { isLocale, LOCALE_LABELS, LOCALES, type Locale } from '../i18n/locales'

/**
 * The language menu of the screen headers. It switches the language (remembered in this browser);
 * `onChosen` lets a screen also save the choice elsewhere, e.g. on the profile.
 */
export function LanguageMenu({ onChosen }: { onChosen?: (locale: Locale) => void }) {
  const { locale, t, setLocale } = useI18n()
  return (
    <select
      aria-label={t.languageLabel}
      value={locale}
      onChange={(e) => {
        const chosen = e.target.value
        if (!isLocale(chosen)) return
        setLocale(chosen)
        onChosen?.(chosen)
      }}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  )
}
