import { useState } from 'react'
import type { SampleId } from './exercises/samples'
import { DEFAULT_A4_HZ, DEFAULT_TOLERANCES } from './music/pitch'
import { DEFAULT_HINT_DELAY_MS, type SessionConfig } from './practice/wait-session'
import type { Exercise } from './score/exercise'
import { ExercisePicker } from './ui/ExercisePicker'
import { PracticeScreen } from './ui/PracticeScreen'

// Plan 1 shows every hint from the start; fading per learned note comes with profiles (plan 2).
const SESSION_CONFIG: SessionConfig = {
  tolerances: DEFAULT_TOLERANCES,
  a4Hz: DEFAULT_A4_HZ,
  hintDelayMs: DEFAULT_HINT_DELAY_MS,
  initialHint: () => true,
}

interface Picked {
  exercise: Exercise
  /** Set for a built-in exercise, whose title is translated. */
  sampleId: SampleId | null
}

export default function App() {
  const [picked, setPicked] = useState<Picked | null>(null)
  if (picked) {
    return (
      <PracticeScreen
        exercise={picked.exercise}
        sampleId={picked.sampleId}
        config={SESSION_CONFIG}
        onExit={() => setPicked(null)}
      />
    )
  }
  return <ExercisePicker onPick={(exercise, sampleId) => setPicked({ exercise, sampleId })} />
}
