import { useI18n } from '../i18n/I18nProvider'
import type { Tolerances } from '../music/pitch'
import type { NeedleReading } from '../practice/engine'

const RANGE_CENTS = 50

export function TuningNeedle({
  reading,
  tolerances,
  preferFlats,
}: {
  reading: NeedleReading | null
  tolerances: Tolerances
  preferFlats: boolean
}) {
  const { t, format } = useI18n()
  const f = format(preferFlats)
  const greenWidth = (tolerances.greenCents / RANGE_CENTS) * 50
  const yellowWidth = (tolerances.yellowCents / RANGE_CENTS) * 50

  let label = t.needle.prompt
  let zone = 'idle'
  let left: number | null = null
  if (reading?.playedMidi != null) {
    label = t.needle.playing(f.note(reading.playedMidi))
    zone = 'off'
  } else if (reading) {
    const cents = Math.round(reading.cents)
    const abs = Math.abs(cents)
    zone = abs <= tolerances.greenCents ? 'green' : abs <= tolerances.yellowCents ? 'yellow' : 'off'
    label = abs === 0 ? t.needle.inTune : t.needle.cents(abs, cents > 0 ? 'sharp' : 'flat', f)
    left = 50 + (Math.max(-RANGE_CENTS, Math.min(RANGE_CENTS, reading.cents)) / RANGE_CENTS) * 50
  }

  return (
    <div className={`needle needle-${zone}`} role="status" aria-live="polite">
      <div className="needle-scale">
        <div className="needle-band needle-band-yellow" style={{ left: `${50 - yellowWidth}%`, width: `${2 * yellowWidth}%` }} />
        <div className="needle-band needle-band-green" style={{ left: `${50 - greenWidth}%`, width: `${2 * greenWidth}%` }} />
        <div className="needle-center" />
        {left !== null && <div className="needle-pointer" style={{ left: `${left}%` }} />}
      </div>
      <div className="needle-labels">
        <span>{t.needle.flatLabel}</span>
        <span className="needle-value">{label}</span>
        <span>{t.needle.sharpLabel}</span>
      </div>
    </div>
  )
}
