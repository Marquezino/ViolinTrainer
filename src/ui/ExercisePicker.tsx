import { useEffect, useRef, useState } from 'react'
import abcjs from 'abcjs'
import { SAMPLE_EXERCISES, type SampleId } from '../exercises/samples'
import { useI18n } from '../i18n/I18nProvider'
import { isLocale, LOCALE_LABELS, LOCALES } from '../i18n/locales'
import { abcProblemText } from '../i18n/messages'
import { parseExercise } from '../score/abc'
import type { Exercise } from '../score/exercise'

const SAMPLES: { id: SampleId; exercise: Exercise }[] = SAMPLE_EXERCISES.map(({ id, abc }) => {
  const result = parseExercise(abc)
  if (!result.ok) throw new Error(`Built-in exercise ${id} is invalid: ${result.errors.map((e) => e.code).join('; ')}`)
  return { id, exercise: result.exercise }
})

function customStart(title: string): string {
  return `X:1
T:${title}
M:4/4
L:1/4
K:D
A B c d |]`
}

/** Draws the ABC as it is typed, including what abcjs can make of text with errors. */
function AbcPreview({ abc, label }: { abc: string; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current) abcjs.renderAbc(containerRef.current, abc, { responsive: 'resize' })
  }, [abc])
  return <div className="score score-preview" ref={containerRef} aria-label={label} />
}

export function ExercisePicker({ onPick }: { onPick: (exercise: Exercise, sampleId: SampleId | null) => void }) {
  const { locale, t, setLocale, format } = useI18n()
  // Only the initial text follows the language: switching language never replaces what was typed.
  const [abc, setAbc] = useState(() => customStart(t.picker.starterTitle))
  const parsed = parseExercise(abc)

  return (
    <main className="picker">
      <header className="picker-header">
        <h1>{t.appName}</h1>
        <select
          aria-label={t.languageLabel}
          value={locale}
          onChange={(e) => {
            if (isLocale(e.target.value)) setLocale(e.target.value)
          }}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </header>
      <section>
        <h2>{t.picker.exercisesHeading}</h2>
        <ul className="exercise-list">
          {SAMPLES.map(({ id, exercise }) => (
            <li key={id}>
              <button type="button" onClick={() => onPick(exercise, id)}>
                {t.sampleTitles[id]}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{t.picker.ownAbcHeading}</h2>
        <textarea
          value={abc}
          onChange={(e) => setAbc(e.target.value)}
          rows={8}
          spellCheck={false}
          aria-label={t.picker.abcLabel}
        />
        <AbcPreview abc={abc} label={t.picker.previewLabel} />
        {parsed.ok ? (
          <>
            {parsed.warnings.map((w, i) => (
              <p key={i} className="warning">
                {abcProblemText(t, w, format(parsed.exercise.preferFlats))}
              </p>
            ))}
            <button type="button" className="primary" onClick={() => onPick(parsed.exercise, null)}>
              {t.picker.practiceThis}
            </button>
          </>
        ) : (
          <ul className="errors" role="alert">
            {parsed.errors.map((e, i) => (
              <li key={i}>{abcProblemText(t, e, format(parsed.preferFlats))}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
