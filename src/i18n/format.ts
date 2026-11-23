import { noteName } from '../music/pitch'
import type { Locale } from './locales'
import type { Formatters, Messages } from './messages/types'

export function formatters(locale: Locale, messages: Messages, preferFlats: boolean): Formatters {
  const numberFormat = new Intl.NumberFormat(locale)
  const pluralRules = new Intl.PluralRules(locale)
  return {
    note: (midi) => noteName(midi, preferFlats, messages.noteNames),
    number: (n) => numberFormat.format(n),
    plural: (n) => pluralRules.select(n),
  }
}
