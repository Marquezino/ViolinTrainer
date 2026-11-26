import { useI18n } from '../i18n/I18nProvider'
import { STREAK_SYMBOLS } from '../i18n/streak-symbols'

export { STREAK_SYMBOLS }

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
