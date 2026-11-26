import { useI18n } from '../i18n/I18nProvider'
import type { StreakKind } from '../store/records'

/** One symbol per streak, the same in both languages. */
export const STREAK_SYMBOLS: Record<StreakKind, string> = { easy: '🌱', practice: '🔥' }

export function StreakBadges({ easy, practice }: { easy: number; practice: number }) {
  const { t, format } = useI18n()
  const f = format(false)
  return (
    <span className="streaks">
      {(['easy', 'practice'] as const).map((kind) => {
        const days = kind === 'easy' ? easy : practice
        return (
          <span key={kind} className="streak" role="img" aria-label={t.streaks.label(kind, days, f)}>
            {STREAK_SYMBOLS[kind]} {f.number(days)}
          </span>
        )
      })}
    </span>
  )
}
