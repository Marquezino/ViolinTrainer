import type { Tolerances } from '../music/pitch'
import type { NeedleReading } from '../practice/engine'

const RANGE_CENTS = 50

export function TuningNeedle({ reading, tolerances }: { reading: NeedleReading | null; tolerances: Tolerances }) {
  const greenWidth = (tolerances.greenCents / RANGE_CENTS) * 50
  const yellowWidth = (tolerances.yellowCents / RANGE_CENTS) * 50

  let label = 'Play the highlighted note'
  let zone = 'idle'
  let left: number | null = null
  if (reading?.playedName) {
    label = `You are playing ${reading.playedName}`
    zone = 'off'
  } else if (reading) {
    const cents = Math.round(reading.cents)
    const abs = Math.abs(cents)
    zone = abs <= tolerances.greenCents ? 'green' : abs <= tolerances.yellowCents ? 'yellow' : 'off'
    label = abs === 0 ? 'In tune' : `${abs} cents ${cents > 0 ? 'sharp' : 'flat'}`
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
        <span>flat</span>
        <span className="needle-value">{label}</span>
        <span>sharp</span>
      </div>
    </div>
  )
}
