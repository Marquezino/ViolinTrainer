import { useEffect, useRef, useState } from 'react'
import abcjs from 'abcjs'
import { useI18n } from '../i18n/I18nProvider'
import { abcProblemText } from '../i18n/messages'
import type { SessionConfig } from '../practice/wait-session'
import { parseExercise } from '../score/abc'
import type { Exercise } from '../score/exercise'
import { LanguageMenu } from './LanguageMenu'
import { PracticeScreen } from './PracticeScreen'

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

/** The Plan 1 "Your own ABC" box. Its runs are practice only: nothing is saved. */
export function TryAbcScreen({ config, onBack }: { config: SessionConfig; onBack: () => void }) {
  const { t, format } = useI18n()
  // Only the initial text follows the language: switching language never replaces what was typed.
  const [abc, setAbc] = useState(() => customStart(t.picker.starterTitle))
  const [playing, setPlaying] = useState<Exercise | null>(null)
  const parsed = parseExercise(abc)

  if (playing) {
    return (
      <PracticeScreen
        exercise={playing}
        title={playing.title ?? t.untitled}
        config={config}
        onExit={() => setPlaying(null)}
      />
    )
  }

  return (
    <main className="picker">
      <header className="screen-header">
        <button type="button" onClick={onBack}>
          {t.picker.back}
        </button>
        <h1>{t.picker.ownAbcHeading}</h1>
        <LanguageMenu />
      </header>
      <section>
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
            <button type="button" className="primary" onClick={() => setPlaying(parsed.exercise)}>
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
