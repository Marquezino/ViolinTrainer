import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { OPEN_STRING_MIDI, TUNING_GREEN_CENTS } from '../practice/tuning'
import { updateProfile } from '../store/profiles'
import { useDb } from './DbProvider'
import { useTuner, type TunerReading } from './useTuner'

const RANGE_CENTS = 50

/**
 * The tuning helper before practice (§7.4): the four open strings, the nearest one highlighted,
 * and a needle that is green within ±5 cents. Nothing is judged or saved; only the
 * "don't show" choice is stored on the profile.
 */
export function TuningScreen(props: {
  profileId: string
  a4Hz: number
  skipTuning: boolean
  onBack: () => void
  onDone: () => void
}) {
  const { profileId, a4Hz, onBack, onDone } = props
  const { t, format } = useI18n()
  const f = format(false)
  const db = useDb()
  const { status, error, reading, start } = useTuner(a4Hz)
  const [skipTuning, setSkipTuning] = useState(props.skipTuning)

  const changeSkip = (checked: boolean) => {
    setSkipTuning(checked)
    void updateProfile(db, profileId, { skipTuning: checked }, Date.now())
  }

  return (
    <main className="tuning">
      <header className="practice-header">
        <button type="button" onClick={onBack}>
          {t.practice.backToPath}
        </button>
        <h1>{t.tuning.heading}</h1>
      </header>
      <p>{t.tuning.intro}</p>

      <ul className="tuning-strings" aria-label={t.tuning.stringsLabel}>
        {OPEN_STRING_MIDI.map((midi) => {
          const current = reading?.midi === midi
          const inTune = current && Math.abs(reading.cents) <= TUNING_GREEN_CENTS
          return (
            <li
              key={midi}
              className={`tuning-string${current ? ' tuning-string-current' : ''}${inTune ? ' tuning-string-green' : ''}`}
              aria-current={current ? 'true' : undefined}
            >
              {f.note(midi)}
            </li>
          )
        })}
      </ul>

      {status === 'running' && <TunerNeedle reading={reading} />}

      {status === 'idle' && (
        <button type="button" className="primary" onClick={start}>
          {t.tuning.listen}
        </button>
      )}

      {status === 'error' && error && (
        <section className="panel panel-error" role="alert">
          <p>{t.microphoneErrors[error.kind]}</p>
          <button type="button" className="primary" onClick={start}>
            {t.tuning.listen}
          </button>
        </section>
      )}

      <div className="tuning-actions">
        <label className="checkbox">
          <input type="checkbox" checked={skipTuning} onChange={(e) => changeSkip(e.target.checked)} />
          {t.tuning.dontShowAgain}
        </label>
        <button type="button" className={status === 'running' ? 'primary' : undefined} onClick={onDone}>
          {status === 'running' ? t.tuning.ready : t.tuning.skip}
        </button>
      </div>
    </main>
  )
}

/** Like the practice needle, but against the nearest open string with only a ±5 cent green band. */
function TunerNeedle({ reading }: { reading: TunerReading | null }) {
  const { t, format } = useI18n()
  const f = format(false)
  const greenWidth = (TUNING_GREEN_CENTS / RANGE_CENTS) * 50

  let label = t.tuning.prompt
  let zone = 'idle'
  let left: number | null = null
  if (reading) {
    const cents = Math.round(reading.cents)
    const abs = Math.abs(cents)
    zone = Math.abs(reading.cents) <= TUNING_GREEN_CENTS ? 'green' : 'tuning'
    label = abs === 0 ? t.needle.inTune : t.needle.cents(abs, cents > 0 ? 'sharp' : 'flat', f)
    left = 50 + (Math.max(-RANGE_CENTS, Math.min(RANGE_CENTS, reading.cents)) / RANGE_CENTS) * 50
  }

  return (
    <div className={`needle needle-${zone}`} role="status" aria-live="polite">
      <div className="needle-scale">
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
