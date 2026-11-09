import { useState } from 'react'
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

export default function App() {
  const [exercise, setExercise] = useState<Exercise | null>(null)
  if (exercise) {
    return <PracticeScreen exercise={exercise} config={SESSION_CONFIG} onExit={() => setExercise(null)} />
  }
  return <ExercisePicker onPick={setExercise} />
}
