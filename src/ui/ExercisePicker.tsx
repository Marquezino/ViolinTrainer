import { useEffect, useRef, useState } from 'react'
import abcjs from 'abcjs'
import { SAMPLE_EXERCISES } from '../exercises/samples'
import { parseExercise } from '../score/abc'
import type { Exercise } from '../score/exercise'

const SAMPLES: Exercise[] = SAMPLE_EXERCISES.map(({ id, abc }) => {
  const result = parseExercise(abc)
  if (!result.ok) throw new Error(`Built-in exercise ${id} is invalid: ${result.errors.join('; ')}`)
  return result.exercise
})

const CUSTOM_START = `X:1
T:My exercise
M:4/4
L:1/4
K:D
A B c d |]`

/** Draws the ABC as it is typed, including what abcjs can make of text with errors. */
function AbcPreview({ abc }: { abc: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current) abcjs.renderAbc(containerRef.current, abc, { responsive: 'resize' })
  }, [abc])
  return <div className="score score-preview" ref={containerRef} aria-label="Score preview" />
}

export function ExercisePicker({ onPick }: { onPick: (exercise: Exercise) => void }) {
  const [abc, setAbc] = useState(CUSTOM_START)
  const parsed = parseExercise(abc)

  return (
    <main className="picker">
      <h1>Violin Trainer</h1>
      <section>
        <h2>Exercises</h2>
        <ul className="exercise-list">
          {SAMPLES.map((exercise) => (
            <li key={exercise.title}>
              <button type="button" onClick={() => onPick(exercise)}>
                {exercise.title}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Your own ABC</h2>
        <textarea
          value={abc}
          onChange={(e) => setAbc(e.target.value)}
          rows={8}
          spellCheck={false}
          aria-label="ABC notation"
        />
        <AbcPreview abc={abc} />
        {parsed.ok ? (
          <>
            {parsed.warnings.map((w) => (
              <p key={w} className="warning">
                {w}
              </p>
            ))}
            <button type="button" className="primary" onClick={() => onPick(parsed.exercise)}>
              Practice this
            </button>
          </>
        ) : (
          <ul className="errors" role="alert">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
