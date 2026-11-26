import { useEffect } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { Celebration as CelebrationItem } from '../progress/celebrations'

export const CELEBRATION_MS = 4000

/** A short card over the top of the screen; a tap or 4 s closes it. Its animation is off under reduced motion (CSS). */
export function Celebration({ items, onDone }: { items: readonly CelebrationItem[]; onDone: () => void }) {
  const { t, format } = useI18n()
  const f = format(false)
  useEffect(() => {
    const timer = setTimeout(onDone, CELEBRATION_MS)
    return () => clearTimeout(timer)
  }, [onDone])
  if (items.length === 0) return null

  return (
    // A tap anywhere on the card closes it; the close button is there for keyboards and screen readers.
    <div className="celebration" role="status" onClick={onDone}>
      {items.map((c, i) => (
        <p key={i} className="celebration-line">
          {c.kind === 'goalReached' && t.celebrations.goalReached}
          {c.kind === 'streakMilestone' && t.celebrations.streakMilestone(c.streak, c.days, f)}
          {c.kind === 'newBestStars' && t.celebrations.newBestStars(c.stars, f)}
        </p>
      ))}
      <button type="button" className="celebration-close" aria-label={t.celebrations.dismiss} onClick={onDone}>
        ×
      </button>
    </div>
  )
}
