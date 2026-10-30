# Violin Trainer: Plan 1 (Core and First Playable Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser app in which a player picks an exercise (built-in or typed in ABC), plays it on the violin into the microphone, and sees wait-mode feedback: a cursor, a tuning needle, string and finger hints, green, yellow or red notes, and stars at the end.

**Architecture:** Every decision is a pure TypeScript function or a small stateful class with no audio and no DOM: pitch math, fingering, ABC parsing, frame analysis, note tracking, the wait-mode session, scoring, and a `PracticeEngine` that combines them. An AudioWorklet only filters and frames the microphone signal. React only draws the engine's snapshot. Synthetic audio drives the same code offline in tests, and Playwright feeds a WAV file through Chrome's fake microphone for an end-to-end check.

**Tech Stack:** Node 26, TypeScript 6 (strict), Vite 8, React 19, Vitest 5, fast-check 4, abcjs 6.7, pitchy 4.1, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-16-violin-trainer-v1-design.md`. This is plan 1 of 3. Plan 2 adds profiles, storage, the editor, the learning path, persisted hint fading, the leaderboard, the parent PIN, import/export, and the tuning screen. Plan 3 adds the recordings suite and labeling tools.

**How this plan was made:** all code below was written and run before the plan was saved. 102 unit tests and 2 end-to-end tests passed with these exact files. Copy code blocks exactly.

## Global Constraints

- Tuning reference: A4 = 440 Hz by default (`DEFAULT_A4_HZ`); every pitch computation takes `a4Hz` as a parameter.
- Default tolerances: green ≤ 20 cents, yellow ≤ 35 cents (`DEFAULT_TOLERANCES`). A different semitone is never accepted.
- A note is stable after 120 ms within ±25 cents; re-attack needs ≥ 30 ms of dip (≥ 6 dB below the note's peak, or unvoiced); a frame is voiced at clarity ≥ 0.90 and level ≥ noise floor + 12 dB.
- Practice is blocked when the room's noise floor is above −50 dBFS (2 s check after Start).
- Hint appears after 5 s without a correct note, and immediately after a red attempt.
- Stars: green 2 points, yellow 1, accepted after a red attempt at most 1; 3★ ≥ 90%, 2★ ≥ 70%, 1★ for finishing.
- Microphone opened with `autoGainControl`, `noiseSuppression` and `echoCancellation` all `false`; 150 Hz high-pass filter before analysis.
- Supported browsers: current Chrome and Firefox on macOS. Android is not tested, but nothing may depend on desktop-only APIs.
- TypeScript only (no WebAssembly). `erasableSyntaxOnly` is on: no enums, no constructor parameter properties, no namespaces.
- **The repository may become public.** Never commit audio recordings (`test-data/recordings/` is ignored), personal or family details, or exercises copied from copyrighted method books (Suzuki, *I Can Read Music*, etc.). Built-in exercises must be written for this project or be traditional melodies.
- Known v1 limitation (accepted): vibrato wider than about ±15 cents prevents a note from becoming stable, so the cursor does not advance. Beginners do not use vibrato; revisit before adults use the app for repertoire.

## Review Focus

These input cases are implied by the spec but easy to miss. Each one has a test in the task that owns the code:

1. **Accidentals carry through the bar** (`^F F` means two F♯s, and the sharp ends at the bar line). If this is wrong, the app marks correct notes red. Test in Task 3.
2. **A clipped, too-loud signal** (player very close to the laptop microphone) must still be measured at the right pitch. Test in Task 5.
3. **Playing during the room check** must block practice with the "too noisy" message, not set a noise floor so high that real notes are ignored. Test in Task 8.
4. **A 44.1 kHz microphone** (common with external microphones and in Firefox) must give the same results as 48 kHz. Tests in Task 5 and Task 8.
5. **Leaving an exercise mid-practice** must release the microphone, so the next exercise can start. End-to-end test in Task 10.

## File Structure

```
.node-version                 Node version for version managers (26)
package.json                  scripts: dev, build, preview, typecheck, test, e2e
tsconfig*.json, vite.config.ts, playwright.config.ts, index.html
src/
  main.tsx, App.tsx, index.css
  music/pitch.ts              cents, judging against tolerances, note names
  music/fingering.ts          first-position string/finger table, labels, note keys
  score/exercise.ts           Exercise and Target types
  score/abc.ts                ABC -> Exercise (via abcjs parseOnly)
  analysis/highpass.ts        biquad high-pass filter (rumble removal)
  analysis/frame-collector.ts stream -> overlapping 2048-sample frames, hop 512
  analysis/frame-analyzer.ts  frame -> { hz, clarity, rmsDb } (pitchy)
  analysis/offline.ts         whole-signal analysis and note tracking (tests, later plan 3)
  analysis/note-tracker.ts    frames -> note events (stability, re-attack)
  analysis/level.ts           noise floor and the too-noisy rule
  analysis/pitch-smoother.ts  median pitch for the tuning needle
  practice/wait-session.ts    wait-mode state machine (pure)
  practice/scoring.ts         points and stars
  practice/engine.ts          frames -> noise check -> tracker -> session -> snapshot
  audio/frame.worklet.ts      AudioWorklet: filter + frame collection on the audio thread
  audio/worklet-globals.d.ts  AudioWorkletGlobalScope declarations
  audio/microphone.ts         getUserMedia + AudioContext + worklet wiring
  exercises/samples.ts        built-in exercises (self-written only)
  ui/ScoreView.tsx            abcjs rendering, note coloring, hint labels
  ui/TuningNeedle.tsx         cents needle
  ui/usePractice.ts           React hook: microphone + engine + animation-frame updates
  ui/PracticeScreen.tsx       practice screen
  ui/ExercisePicker.tsx       built-in list and "your own ABC" box
  test-support/synth.ts       synthetic tones, noise, rumble (tests only)
  test-support/wav.ts         WAV encoder (tests only)
e2e/
  generate-fixtures.ts        writes fake-microphone WAV files
  practice.spec.ts            Playwright tests through Chrome's fake microphone
```

---

### Task 1: Project scaffold and pitch math

**Files:**
- Create: `.node-version`, `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Modify: `.gitignore`
- Create: `src/music/pitch.ts`
- Test: `src/music/pitch.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (`src/music/pitch.ts`):
  - `DEFAULT_A4_HZ = 440`
  - `interface Tolerances { greenCents: number; yellowCents: number }`, `DEFAULT_TOLERANCES`
  - `type JudgementKind = 'green' | 'yellow' | 'outOfTune' | 'wrongNote'`
  - `interface Judgement { kind: JudgementKind; cents: number; playedMidi: number }`
  - `midiToHz(midi, a4Hz?)`, `hzToMidiFloat(hz, a4Hz?)`, `centsBetween(hz, referenceHz)`
  - `validateTolerances(t): string | null`
  - `judge(hz, targetMidi, tolerances, a4Hz?): Judgement`
  - `noteName(midi, preferFlats): string` (for example `'B♭4'`)

- [ ] **Step 1: Check Node**

Run: `node --version`
Expected: `v24` or later (the project pins 26 in `.node-version`). If Node is missing on macOS: `brew install node`.

- [ ] **Step 2: Create the project files**

`.node-version`:

```
26
```

`package.json` (abcjs, pitchy and Playwright are added by the tasks that need them):

```json
{
  "name": "violin-trainer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "e2e": "node e2e/generate-fixtures.ts && playwright test"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vitejs/plugin-react": "^6.1.1",
    "fast-check": "^4.10.2",
    "typescript": "~6.0.2",
    "vite": "^8.3.0",
    "vitest": "^5.0.5"
  }
}
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "playwright.config.ts", "e2e"]
}
```

`vite.config.ts` (Vitest only picks up unit tests under `src/`; Playwright specs live in `e2e/`):

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Violin Trainer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx` (placeholder; replaced in Task 9):

```tsx
export default function App() {
  return (
    <main>
      <h1>Violin Trainer</h1>
    </main>
  )
}
```

`src/index.css` (placeholder; replaced in Task 9):

```css
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

Append to `.gitignore` (keep the existing `violin-trainer-brief.md` line):

```
node_modules/
dist/
*.local
.DS_Store
test-results/
playwright-report/
# Recordings of people playing are never committed (the repo may become public).
test-data/recordings/
# Generated by e2e/generate-fixtures.ts
e2e/fixtures/*.wav
```

- [ ] **Step 3: Install and check that the empty app builds**

Run: `npm install && npm run build`
Expected: `✓ built in …`. npm may print a note about install scripts; it can be ignored.

- [ ] **Step 4: Write the failing test**

`src/music/pitch.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
import {
  DEFAULT_TOLERANCES,
  centsBetween,
  hzToMidiFloat,
  judge,
  midiToHz,
  noteName,
  validateTolerances,
} from './pitch'

describe('conversions', () => {
  test('A4 is 440 Hz by default and follows the reference', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(69, 442)).toBe(442)
    expect(midiToHz(55)).toBeCloseTo(196.0, 1) // open G
    expect(midiToHz(81)).toBeCloseTo(880, 6)
  })

  test('hzToMidiFloat inverts midiToHz', () => {
    expect(hzToMidiFloat(440)).toBe(69)
    expect(hzToMidiFloat(midiToHz(62))).toBeCloseTo(62, 9)
  })

  test('cents', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 9)
    expect(centsBetween(445, 440)).toBeCloseTo(19.56, 2)
    expect(centsBetween(450, 440)).toBeCloseTo(38.9, 1)
  })
})

describe('judge', () => {
  const tol = DEFAULT_TOLERANCES // green 20, yellow 35

  test('classifies by deviation from the target', () => {
    expect(judge(440, 69, tol).kind).toBe('green')
    expect(judge(445, 69, tol).kind).toBe('green') // +19.6 cents
    expect(judge(447, 69, tol).kind).toBe('yellow') // +27.3 cents
    expect(judge(450, 69, tol).kind).toBe('outOfTune') // +38.9 cents
    expect(judge(466.16, 69, tol)).toMatchObject({ kind: 'wrongNote', playedMidi: 70 })
  })

  test('uses the configured A4', () => {
    expect(judge(442, 69, tol, 442).kind).toBe('green')
    expect(judge(442, 69, tol, 440).kind).toBe('green') // +7.9 cents
  })

  test('PROPERTY: a deviation beyond the yellow tolerance is never accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 55, max: 83 }),
        fc.double({ min: -600, max: 600, noNaN: true }),
        (target, cents) => {
          fc.pre(Math.abs(Math.abs(cents) - tol.yellowCents) > 1e-6)
          const hz = midiToHz(target) * 2 ** (cents / 1200)
          const kind = judge(hz, target, tol).kind
          const accepted = kind === 'green' || kind === 'yellow'
          if (Math.abs(cents) > tol.yellowCents) expect(accepted).toBe(false)
        },
      ),
    )
  })

  test('PROPERTY: a different semitone or octave is never accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 55, max: 83 }),
        fc.integer({ min: -24, max: 24 }).filter((d) => d !== 0),
        fc.double({ min: -49, max: 49, noNaN: true }),
        (target, semitones, cents) => {
          const hz = midiToHz(target + semitones) * 2 ** (cents / 1200)
          expect(judge(hz, target, tol).kind).toBe('wrongNote')
        },
      ),
    )
  })
})

describe('validateTolerances', () => {
  test('accepts the defaults', () => {
    expect(validateTolerances(DEFAULT_TOLERANCES)).toBeNull()
  })
  test('rejects inconsistent values', () => {
    expect(validateTolerances({ greenCents: 0, yellowCents: 10 })).not.toBeNull()
    expect(validateTolerances({ greenCents: 30, yellowCents: 20 })).not.toBeNull()
    expect(validateTolerances({ greenCents: 20, yellowCents: 50 })).not.toBeNull()
  })
})

describe('noteName', () => {
  test('names notes with octave numbers', () => {
    expect(noteName(55, false)).toBe('G3')
    expect(noteName(60, false)).toBe('C4')
    expect(noteName(70, false)).toBe('A♯4')
    expect(noteName(70, true)).toBe('B♭4')
  })
})
```

- [ ] **Step 5: Run it to see it fail**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./pitch"`.

- [ ] **Step 6: Implement**

`src/music/pitch.ts`:

```ts
export const DEFAULT_A4_HZ = 440

export interface Tolerances {
  greenCents: number
  yellowCents: number
}

export const DEFAULT_TOLERANCES: Tolerances = { greenCents: 20, yellowCents: 35 }

export type JudgementKind = 'green' | 'yellow' | 'outOfTune' | 'wrongNote'

export interface Judgement {
  kind: JudgementKind
  /** Deviation from the target note, in cents. */
  cents: number
  /** The equal-tempered note closest to what was played. */
  playedMidi: number
}

export function midiToHz(midi: number, a4Hz: number = DEFAULT_A4_HZ): number {
  return a4Hz * 2 ** ((midi - 69) / 12)
}

export function hzToMidiFloat(hz: number, a4Hz: number = DEFAULT_A4_HZ): number {
  return 69 + 12 * Math.log2(hz / a4Hz)
}

export function centsBetween(hz: number, referenceHz: number): number {
  return 1200 * Math.log2(hz / referenceHz)
}

export function validateTolerances(t: Tolerances): string | null {
  if (!(t.greenCents > 0)) return 'The green tolerance must be greater than 0 cents.'
  if (t.yellowCents < t.greenCents) return 'The yellow tolerance must not be smaller than the green tolerance.'
  if (t.yellowCents >= 50) return 'The yellow tolerance must be below 50 cents (half a semitone).'
  return null
}

export function judge(
  hz: number,
  targetMidi: number,
  tolerances: Tolerances,
  a4Hz: number = DEFAULT_A4_HZ,
): Judgement {
  const cents = centsBetween(hz, midiToHz(targetMidi, a4Hz))
  const playedMidi = Math.round(hzToMidiFloat(hz, a4Hz))
  if (playedMidi !== targetMidi) return { kind: 'wrongNote', cents, playedMidi }
  const deviation = Math.abs(cents)
  if (deviation <= tolerances.greenCents) return { kind: 'green', cents, playedMidi }
  if (deviation <= tolerances.yellowCents) return { kind: 'yellow', cents, playedMidi }
  return { kind: 'outOfTune', cents, playedMidi }
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

export function noteName(midi: number, preferFlats: boolean): string {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES
  const pitchClass = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${names[pitchClass]}${octave}`
}
```

- [ ] **Step 7: Run tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests in `pitch.test.ts` pass; no type errors.

- [ ] **Step 8: Commit**

```bash
git add .node-version package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html src .gitignore
git commit -m "feat: scaffold Vite + React + Vitest project and pitch math"
```

---

### Task 2: First-position fingering

**Files:**
- Create: `src/music/fingering.ts`
- Test: `src/music/fingering.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ViolinString = 'G' | 'D' | 'A' | 'E'`, `type Finger = 0 | 1 | 2 | 3 | 4`, `type FingerMark = 'low' | 'high' | null`
  - `interface Fingering { string: ViolinString; finger: Finger; mark: FingerMark }`
  - `FIRST_POSITION_LOWEST_MIDI = 55`, `FIRST_POSITION_HIGHEST_MIDI = 83`
  - `defaultFingering(midi): Fingering | null` (open string when there is a choice)
  - `fingeringWithFinger(midi, finger): Fingering | null`
  - `fingeringLabel(f): string` (for example `'A 2↑'`)
  - `noteKey(midi, f): string` (for example `'69:D4'`; used by hint fading in plan 2)

The table extends spec section 7 with "high 3" (C♯4, G♯4, D♯5, A♯5), so every semitone from G3 to B5 has a fingering.

- [ ] **Step 1: Write the failing test**

`src/music/fingering.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  FIRST_POSITION_HIGHEST_MIDI,
  FIRST_POSITION_LOWEST_MIDI,
  defaultFingering,
  fingeringLabel,
  fingeringWithFinger,
  noteKey,
} from './fingering'

describe('defaultFingering', () => {
  test('open strings', () => {
    expect(defaultFingering(55)).toEqual({ string: 'G', finger: 0, mark: null })
    expect(defaultFingering(62)).toEqual({ string: 'D', finger: 0, mark: null })
    expect(defaultFingering(69)).toEqual({ string: 'A', finger: 0, mark: null })
    expect(defaultFingering(76)).toEqual({ string: 'E', finger: 0, mark: null })
  })

  test('fingers on the A string', () => {
    expect(defaultFingering(70)).toEqual({ string: 'A', finger: 1, mark: 'low' }) // B♭4
    expect(defaultFingering(71)).toEqual({ string: 'A', finger: 1, mark: null }) // B4
    expect(defaultFingering(72)).toEqual({ string: 'A', finger: 2, mark: 'low' }) // C5
    expect(defaultFingering(73)).toEqual({ string: 'A', finger: 2, mark: 'high' }) // C♯5
    expect(defaultFingering(74)).toEqual({ string: 'A', finger: 3, mark: null }) // D5
    expect(defaultFingering(75)).toEqual({ string: 'A', finger: 3, mark: 'high' }) // D♯5
  })

  test('highest first-position note is 4th finger on E', () => {
    expect(defaultFingering(83)).toEqual({ string: 'E', finger: 4, mark: null })
  })

  test('outside first position there is no fingering', () => {
    expect(defaultFingering(FIRST_POSITION_LOWEST_MIDI - 1)).toBeNull()
    expect(defaultFingering(FIRST_POSITION_HIGHEST_MIDI + 1)).toBeNull()
  })

  test('every note in range has a fingering', () => {
    for (let m = FIRST_POSITION_LOWEST_MIDI; m <= FIRST_POSITION_HIGHEST_MIDI; m++) {
      expect(defaultFingering(m)).not.toBeNull()
    }
  })
})

describe('fingeringWithFinger', () => {
  test('4th finger instead of the open string', () => {
    expect(fingeringWithFinger(69, 4)).toEqual({ string: 'D', finger: 4, mark: null })
    expect(fingeringWithFinger(62, 4)).toEqual({ string: 'G', finger: 4, mark: null })
    expect(fingeringWithFinger(76, 4)).toEqual({ string: 'A', finger: 4, mark: null })
  })

  test('explicit open string', () => {
    expect(fingeringWithFinger(69, 0)).toEqual({ string: 'A', finger: 0, mark: null })
  })

  test('impossible combinations return null', () => {
    expect(fingeringWithFinger(71, 3)).toBeNull() // B4 is never 3rd finger in first position
    expect(fingeringWithFinger(55, 4)).toBeNull()
  })
})

describe('labels and keys', () => {
  test('label shows string, finger and mark', () => {
    expect(fingeringLabel({ string: 'A', finger: 2, mark: 'high' })).toBe('A 2↑')
    expect(fingeringLabel({ string: 'D', finger: 1, mark: 'low' })).toBe('D 1↓')
    expect(fingeringLabel({ string: 'E', finger: 0, mark: null })).toBe('E 0')
  })

  test('note key distinguishes the same pitch on different strings', () => {
    expect(noteKey(69, { string: 'A', finger: 0, mark: null })).toBe('69:A0')
    expect(noteKey(69, { string: 'D', finger: 4, mark: null })).toBe('69:D4')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/music/fingering.test.ts`
Expected: FAIL, `Failed to resolve import "./fingering"`.

- [ ] **Step 3: Implement**

`src/music/fingering.ts`:

```ts
export type ViolinString = 'G' | 'D' | 'A' | 'E'
export type Finger = 0 | 1 | 2 | 3 | 4
export type FingerMark = 'low' | 'high' | null

export interface Fingering {
  string: ViolinString
  finger: Finger
  mark: FingerMark
}

const OPEN_STRING_MIDI: Record<ViolinString, number> = { G: 55, D: 62, A: 69, E: 76 }
const STRINGS: ViolinString[] = ['G', 'D', 'A', 'E']

/** First position: semitones above the open string -> finger and mark. */
const BY_OFFSET: { finger: Finger; mark: FingerMark }[] = [
  { finger: 0, mark: null },
  { finger: 1, mark: 'low' },
  { finger: 1, mark: null },
  { finger: 2, mark: 'low' },
  { finger: 2, mark: 'high' },
  { finger: 3, mark: null },
  { finger: 3, mark: 'high' },
  { finger: 4, mark: null },
]

export const FIRST_POSITION_LOWEST_MIDI = 55 // G3
export const FIRST_POSITION_HIGHEST_MIDI = 83 // B5

function candidates(midi: number): Fingering[] {
  const result: Fingering[] = []
  for (const string of STRINGS) {
    const offset = midi - OPEN_STRING_MIDI[string]
    if (offset >= 0 && offset < BY_OFFSET.length) result.push({ string, ...BY_OFFSET[offset] })
  }
  return result
}

/** Beginner default: the open string when there is a choice. Null outside first position. */
export function defaultFingering(midi: number): Fingering | null {
  const options = candidates(midi)
  return options.find((f) => f.finger === 0) ?? options[0] ?? null
}

/** The first-position fingering that uses `finger` for this pitch, or null if none exists. */
export function fingeringWithFinger(midi: number, finger: Finger): Fingering | null {
  return candidates(midi).find((f) => f.finger === finger) ?? null
}

export function fingeringLabel(f: Fingering): string {
  const mark = f.mark === 'low' ? '↓' : f.mark === 'high' ? '↑' : ''
  return `${f.string} ${f.finger}${mark}`
}

/** Identifies a note as the reader learns it: pitch plus where it is played. */
export function noteKey(midi: number, f: Fingering): string {
  return `${midi}:${f.string}${f.finger}`
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/music/fingering.ts src/music/fingering.test.ts
git commit -m "feat: first-position fingering table with overrides and labels"
```

---

### Task 3: ABC to exercise

**Files:**
- Create: `src/score/exercise.ts`, `src/score/abc.ts`
- Test: `src/score/abc.test.ts`

**Interfaces:**
- Consumes: `defaultFingering`, `fingeringWithFinger`, `Finger`, `Fingering` (Task 2); `noteName` (Task 1).
- Produces:
  - `interface Target { index; midi; durationWhole; fingering: Fingering | null; sourceStart }`
  - `interface Exercise { title; abc; targets: Target[]; preferFlats }`
  - `type ParseResult = { ok: true; exercise; warnings: string[] } | { ok: false; errors: string[] }`
  - `parseExercise(abc: string): ParseResult`
  - `exerciseFromTune(tune: TuneObject, abc: string): ParseResult`

Facts about abcjs 6.7 that this code relies on (checked):
- `abcjs.parseOnly(abc)` works in Node, without a DOM.
- After `tune.setUpAudio({})`, each note item has `midiPitches[0].pitch`, with the key signature and bar accidentals applied.
- A tied continuation has `pitches[0].endTie === true` and no `midiPitches`.
- `!0!` … `!4!` appear in `decoration` as `'0'` … `'4'`.
- Syntax problems appear in `tune.warnings` as HTML strings.
- `startChar` is the note's offset in the ABC text, and the rendered tune has the same items. ScoreView uses it to find each note's SVG elements.
- `decoration`, `midiPitches`, `gracenotes` and `abselem` exist at runtime but not in abcjs's type definitions, hence the local `AbcNote` interface.

- [ ] **Step 1: Install abcjs**

Run: `npm install abcjs@^6.7.1`

- [ ] **Step 2: Write the failing test**

`src/score/abc.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { parseExercise } from './abc'
import type { Exercise, ParseResult } from './exercise'

const header = 'X:1\nT:Test\nM:4/4\nL:1/4\nK:D\n'

function ok(result: ParseResult): Exercise {
  if (!result.ok) throw new Error(`expected success, got: ${result.errors.join('; ')}`)
  return result.exercise
}

describe('parseExercise', () => {
  test('reads pitches with the key signature applied', () => {
    const ex = ok(parseExercise(header + 'G, D A e | f c |]'))
    expect(ex.title).toBe('Test')
    expect(ex.targets.map((t) => t.midi)).toEqual([55, 62, 69, 76, 78, 73]) // f and c are sharp in D major
    expect(ex.targets.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5])
  })

  test('accidentals carry through the bar and reset at the bar line', () => {
    const ex = ok(parseExercise('X:1\nL:1/4\nK:C\n^F F G F | F |]'))
    expect(ex.targets.map((t) => t.midi)).toEqual([66, 66, 67, 66, 65])
  })

  test('assigns default fingerings', () => {
    const ex = ok(parseExercise(header + 'A B c d |]'))
    expect(ex.targets.map((t) => t.fingering)).toEqual([
      { string: 'A', finger: 0, mark: null },
      { string: 'A', finger: 1, mark: null },
      { string: 'A', finger: 2, mark: 'high' },
      { string: 'A', finger: 3, mark: null },
    ])
  })

  test('a finger decoration overrides the default', () => {
    const ex = ok(parseExercise(header + '!4!A !0!A |]'))
    expect(ex.targets[0].fingering).toEqual({ string: 'D', finger: 4, mark: null })
    expect(ex.targets[1].fingering).toEqual({ string: 'A', finger: 0, mark: null })
  })

  test('an impossible finger is an error', () => {
    const result = parseExercise(header + '!3!B |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/B4 cannot be played with finger 3/)
  })

  test('skips rests and merges tied notes', () => {
    const ex = ok(parseExercise(header + 'z A2- | A2 B2 |]'))
    expect(ex.targets.map((t) => t.midi)).toEqual([69, 71])
    expect(ex.targets[0].durationWhole).toBe(1) // half tied to half
    expect(ex.targets[1].durationWhole).toBe(0.5)
  })

  test('keeps the source position of each note', () => {
    const abc = header + 'A B |]'
    const ex = ok(parseExercise(abc))
    expect(abc.slice(ex.targets[0].sourceStart, ex.targets[0].sourceStart + 1)).toBe('A')
    expect(abc.slice(ex.targets[1].sourceStart, ex.targets[1].sourceStart + 1)).toBe('B')
  })

  test('notes outside first position have no fingering and produce a warning', () => {
    const result = parseExercise(header + "A c' |]")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.exercise.targets[1].fingering).toBeNull()
      expect(result.warnings[0]).toMatch(/C♯6 is outside first position/)
    }
  })

  test('prefers flats in flat keys', () => {
    expect(ok(parseExercise('X:1\nL:1/4\nK:F\nB |]')).preferFlats).toBe(true)
    expect(ok(parseExercise(header + 'B |]')).preferFlats).toBe(false)
  })

  test('rejects chords', () => {
    const result = parseExercise(header + '[GB] A |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/Chords and double stops/)
  })

  test('rejects syntax errors with readable messages', () => {
    const result = parseExercise(header + 'A ) B |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).not.toMatch(/<span/)
  })

  test('rejects an exercise without notes', () => {
    expect(parseExercise(header + 'z4 |]')).toEqual({ ok: false, errors: ['The exercise has no notes.'] })
  })

  test('rejects text that is not a tune', () => {
    expect(parseExercise('').ok).toBe(false)
  })

  test('rejects two voices', () => {
    const result = parseExercise('X:1\nL:1/4\nK:C\nV:1\nA B |]\nV:2\nc d |]')
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/score`
Expected: FAIL, `Failed to resolve import "./abc"`.

- [ ] **Step 4: Implement**

`src/score/exercise.ts`:

```ts
import type { Fingering } from '../music/fingering'

export interface Target {
  index: number
  midi: number
  /** Written duration as a fraction of a whole note (ties merged). */
  durationWhole: number
  /** Null when the note is outside first position: no hint is shown. */
  fingering: Fingering | null
  /** Character offset of the note in the ABC source; links the target to its rendered element. */
  sourceStart: number
}

export interface Exercise {
  title: string
  abc: string
  targets: Target[]
  /** Spell played notes with flats (for keys with flats in the signature). */
  preferFlats: boolean
}

export type ParseResult =
  | { ok: true; exercise: Exercise; warnings: string[] }
  | { ok: false; errors: string[] }
```

`src/score/abc.ts`:

```ts
import abcjs from 'abcjs'
import type { TuneObject } from 'abcjs'
import { defaultFingering, fingeringWithFinger, type Finger } from '../music/fingering'
import { noteName } from '../music/pitch'
import type { Exercise, ParseResult, Target } from './exercise'

/** Runtime fields abcjs sets on note elements that its type definitions leave out. */
interface AbcNote {
  el_type: 'note'
  startChar: number
  duration: number
  pitches?: { name: string; endTie?: boolean }[]
  rest?: unknown
  decoration?: string[]
  gracenotes?: unknown[]
  midiPitches?: { pitch: number }[]
}

const FINGER_DECORATIONS = new Set(['0', '1', '2', '3', '4'])

export function parseExercise(abc: string): ParseResult {
  const tunes = abcjs.parseOnly(abc) as TuneObject[]
  if (tunes.length === 0) {
    return { ok: false, errors: ['No tune found. An exercise needs an X: line and a K: line.'] }
  }
  if (tunes.length > 1) return { ok: false, errors: ['Write only one tune per exercise.'] }
  return exerciseFromTune(tunes[0], abc)
}

/** Builds an exercise from a tune that abcjs has parsed (or rendered). */
export function exerciseFromTune(tune: TuneObject, abc: string): ParseResult {
  const errors = (tune.warnings ?? []).map(stripHtml)
  const warnings: string[] = []
  tune.setUpAudio({})

  const preferFlats = (tune.getKeySignature().accidentals ?? []).some((a) => a.acc === 'flat')
  const targets: Target[] = []

  for (const line of tune.lines) {
    if (!line.staff) continue
    if (line.staff.length > 1 || line.staff.some((s) => (s.voices?.length ?? 0) > 1)) {
      errors.push('Only a single melody line is supported (one staff, one voice).')
      break
    }
    for (const item of line.staff[0]?.voices?.[0] ?? []) {
      if (item.el_type !== 'note') continue
      const note = item as unknown as AbcNote
      if (note.rest || !note.pitches) continue
      const at = `at character ${note.startChar}`
      if (note.pitches.length > 1) {
        errors.push(`Chords and double stops are not supported yet (${at}).`)
        continue
      }
      if (note.gracenotes?.length) {
        errors.push(`Grace notes are not supported yet (${at}).`)
        continue
      }
      if (note.pitches[0].endTie) {
        const previous = targets[targets.length - 1]
        if (previous) previous.durationWhole += note.duration
        continue
      }
      const midi = note.midiPitches?.[0]?.pitch
      if (midi === undefined) {
        errors.push(`Could not determine the pitch of the note ${at}.`)
        continue
      }
      const fingers = (note.decoration ?? []).filter((d) => FINGER_DECORATIONS.has(d))
      if ((note.decoration ?? []).includes('5')) {
        errors.push(`Finger 5 does not exist on the violin (${at}).`)
        continue
      }
      let fingering = defaultFingering(midi)
      if (fingers.length > 0) {
        const finger = Number(fingers[0]) as Finger
        fingering = fingeringWithFinger(midi, finger)
        if (fingering === null) {
          errors.push(
            `${noteName(midi, preferFlats)} cannot be played with finger ${finger} in first position (${at}).`,
          )
          continue
        }
      } else if (fingering === null) {
        warnings.push(
          `${noteName(midi, preferFlats)} is outside first position; no hint is shown for it (${at}).`,
        )
      }
      targets.push({
        index: targets.length,
        midi,
        durationWhole: note.duration,
        fingering,
        sourceStart: note.startChar,
      })
    }
  }

  if (errors.length === 0 && targets.length === 0) errors.push('The exercise has no notes.')
  if (errors.length > 0) return { ok: false, errors }

  const exercise: Exercise = {
    title: tune.metaText.title ?? 'Untitled',
    abc,
    targets,
    preferFlats,
  }
  return { ok: true, exercise, warnings }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/score
git commit -m "feat: parse ABC exercises into targets with fingerings"
```

---

### Task 4: Test signals, high-pass filter and frame collector

**Files:**
- Create: `src/test-support/synth.ts`, `src/analysis/highpass.ts`, `src/analysis/frame-collector.ts`
- Test: `src/analysis/highpass.test.ts`, `src/analysis/frame-collector.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `synth.ts` (tests only): `SAMPLE_RATE = 48000`, `VIOLIN_HARMONICS`, `WEAK_FUNDAMENTAL_HARMONICS`, `interface ToneSpec`, `tone(spec, sampleRate?)`, `silence(ms, sampleRate?)`, `noise(ms, amplitude, seed?, sampleRate?)`, `rumble(ms, amplitude, sampleRate?)`, `concat(...parts)`, `mix(...parts)`
  - `HIGH_PASS_HZ = 150`, `class HighPassFilter { constructor(cutoffHz, sampleRate, q?); process(input, output?): Float32Array }`
  - `FRAME_SIZE = 2048`, `HOP_SIZE = 512`, `class FrameCollector { constructor(frameSize, hopSize, onFrame: (frame, endSample) => void); push(block) }`

`synth.ts` is test-only code under `src/` so it can be shared by unit tests and the e2e fixture generator.

- [ ] **Step 1: Write the test signal generator**

`src/test-support/synth.ts`:

```ts
/** Synthetic test signals with known content. Test-only code. */

export const SAMPLE_RATE = 48000

/** Relative harmonic amplitudes roughly like a bowed violin. */
export const VIOLIN_HARMONICS = [1, 0.6, 0.5, 0.35, 0.3, 0.2, 0.15, 0.1]
/** Low notes on the G string: weak fundamental, strong 2nd and 3rd harmonics. */
export const WEAK_FUNDAMENTAL_HARMONICS = [0.15, 1, 0.8, 0.5, 0.3, 0.2]

export interface ToneSpec {
  hz: number
  ms: number
  amplitude?: number
  harmonics?: number[]
  /** Pitch at the end of the tone; the pitch moves linearly in cents (a slide). */
  endHz?: number
  vibrato?: { rateHz: number; widthCents: number }
  attackMs?: number
  releaseMs?: number
}

export function tone(spec: ToneSpec, sampleRate = SAMPLE_RATE): Float32Array {
  const n = Math.round((spec.ms / 1000) * sampleRate)
  const out = new Float32Array(n)
  const harmonics = spec.harmonics ?? [1]
  const norm = harmonics.reduce((a, b) => a + b, 0)
  const amplitude = spec.amplitude ?? 0.3
  const attack = Math.round(((spec.attackMs ?? 10) / 1000) * sampleRate)
  const release = Math.round(((spec.releaseMs ?? 10) / 1000) * sampleRate)
  const slideCents = spec.endHz ? 1200 * Math.log2(spec.endHz / spec.hz) : 0
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    let cents = slideCents * (i / n)
    if (spec.vibrato) cents += spec.vibrato.widthCents * Math.sin(2 * Math.PI * spec.vibrato.rateHz * t)
    const f = spec.hz * 2 ** (cents / 1200)
    phase += (2 * Math.PI * f) / sampleRate
    let s = 0
    for (let h = 0; h < harmonics.length; h++) s += harmonics[h] * Math.sin((h + 1) * phase)
    let env = 1
    if (i < attack) env = i / attack
    if (i >= n - release) env = Math.min(env, (n - i) / release)
    out[i] = (amplitude * env * s) / norm
  }
  return out
}

export function silence(ms: number, sampleRate = SAMPLE_RATE): Float32Array {
  return new Float32Array(Math.round((ms / 1000) * sampleRate))
}

/** Deterministic white noise. */
export function noise(ms: number, amplitude: number, seed = 1, sampleRate = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(Math.round((ms / 1000) * sampleRate))
  let state = seed >>> 0
  for (let i = 0; i < out.length; i++) {
    state = (state + 0x6d2b79f5) >>> 0
    let x = state
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    const r = ((x ^ (x >>> 14)) >>> 0) / 4294967296
    out[i] = amplitude * (2 * r - 1)
  }
  return out
}

/** Traffic-like low rumble: a few low sinusoids. */
export function rumble(ms: number, amplitude: number, sampleRate = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(Math.round((ms / 1000) * sampleRate))
  const parts = [
    { hz: 35, phase: 0.3 },
    { hz: 52, phase: 1.1 },
    { hz: 71, phase: 2.0 },
    { hz: 94, phase: 0.7 },
  ]
  for (let i = 0; i < out.length; i++) {
    let s = 0
    for (const p of parts) s += Math.sin(2 * Math.PI * p.hz * (i / sampleRate) + p.phase)
    out[i] = (amplitude * s) / parts.length
  }
  return out
}

export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/** Sample-wise sum; the result is as long as the longest input. */
export function mix(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(Math.max(...parts.map((p) => p.length)))
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i]
  return out
}
```

- [ ] **Step 2: Write the failing tests**

`src/analysis/highpass.test.ts`:

```ts
import { expect, test } from 'vitest'
import { HighPassFilter } from './highpass'
import { SAMPLE_RATE, tone } from '../test-support/synth'

function rms(x: Float32Array, from = 0): number {
  let s = 0
  for (let i = from; i < x.length; i++) s += x[i] * x[i]
  return Math.sqrt(s / (x.length - from))
}

function gainDb(hz: number): number {
  const input = tone({ hz, ms: 1000, attackMs: 0, releaseMs: 0 })
  const output = new HighPassFilter(150, SAMPLE_RATE).process(input)
  const settle = SAMPLE_RATE / 4 // skip the filter's start-up transient
  return 20 * Math.log10(rms(output, settle) / rms(input, settle))
}

test('removes traffic rumble', () => {
  expect(gainDb(50)).toBeLessThan(-18)
})

test('keeps the lowest violin note', () => {
  expect(gainDb(196)).toBeGreaterThan(-1.5)
})

test('passes higher notes unchanged', () => {
  expect(Math.abs(gainDb(880))).toBeLessThan(0.2)
})

test('keeps state across blocks', () => {
  const input = tone({ hz: 196, ms: 100 })
  const whole = new HighPassFilter(150, SAMPLE_RATE).process(input)
  const filter = new HighPassFilter(150, SAMPLE_RATE)
  const a = filter.process(input.subarray(0, 1000))
  const b = filter.process(input.subarray(1000))
  expect(Array.from(a).concat(Array.from(b))).toEqual(Array.from(whole))
})
```

`src/analysis/frame-collector.test.ts`:

```ts
import { expect, test } from 'vitest'
import { FrameCollector } from './frame-collector'

function ramp(from: number, length: number): Float32Array {
  return Float32Array.from({ length }, (_, i) => from + i)
}

test('emits the first frame once it is full, then every hop', () => {
  const frames: { first: number; last: number; end: number }[] = []
  const c = new FrameCollector(8, 4, (f, end) => frames.push({ first: f[0], last: f[7], end }))
  c.push(ramp(0, 7))
  expect(frames).toEqual([])
  c.push(ramp(7, 1))
  expect(frames).toEqual([{ first: 0, last: 7, end: 8 }])
  c.push(ramp(8, 8))
  expect(frames).toEqual([
    { first: 0, last: 7, end: 8 },
    { first: 4, last: 11, end: 12 },
    { first: 8, last: 15, end: 16 },
  ])
})

test('block size does not change the frames (128-sample worklet blocks vs one big block)', () => {
  const signal = ramp(0, 5000)
  const a: number[][] = []
  const b: number[][] = []
  const big = new FrameCollector(2048, 512, (f) => a.push([f[0], f[2047]]))
  big.push(signal)
  const small = new FrameCollector(2048, 512, (f) => b.push([f[0], f[2047]]))
  for (let i = 0; i < signal.length; i += 128) small.push(signal.subarray(i, i + 128))
  expect(b).toEqual(a)
  expect(a.length).toBe(6) // ends at 2048, 2560, 3072, 3584, 4096, 4608
})

test('each frame is a separate copy', () => {
  const frames: Float32Array[] = []
  const c = new FrameCollector(4, 2, (f) => frames.push(f))
  c.push(ramp(0, 6))
  expect(Array.from(frames[0])).toEqual([0, 1, 2, 3])
  expect(Array.from(frames[1])).toEqual([2, 3, 4, 5])
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/analysis`
Expected: FAIL, `Failed to resolve import "./highpass"` and `"./frame-collector"`.

- [ ] **Step 4: Implement**

`src/analysis/highpass.ts`:

```ts
/** Removes traffic rumble below the violin's lowest note (G3, 196 Hz). */
export const HIGH_PASS_HZ = 150

/** Second-order (Butterworth) high-pass filter, RBJ cookbook form. Keeps state across blocks. */
export class HighPassFilter {
  private readonly b0: number
  private readonly b1: number
  private readonly b2: number
  private readonly a1: number
  private readonly a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(cutoffHz: number, sampleRate: number, q = Math.SQRT1_2) {
    const w0 = (2 * Math.PI * cutoffHz) / sampleRate
    const alpha = Math.sin(w0) / (2 * q)
    const cos = Math.cos(w0)
    const a0 = 1 + alpha
    this.b0 = (1 + cos) / 2 / a0
    this.b1 = -(1 + cos) / a0
    this.b2 = (1 + cos) / 2 / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }

  process(input: Float32Array, output: Float32Array = new Float32Array(input.length)): Float32Array {
    for (let i = 0; i < input.length; i++) {
      const x = input[i]
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
      this.x2 = this.x1
      this.x1 = x
      this.y2 = this.y1
      this.y1 = y
      output[i] = y
    }
    return output
  }
}
```

`src/analysis/frame-collector.ts`:

```ts
export const FRAME_SIZE = 2048
export const HOP_SIZE = 512

/**
 * Turns a stream of audio blocks (any size) into overlapping frames.
 * Calls onFrame with a fresh copy of the last `frameSize` samples every `hopSize` samples,
 * and the total number of samples received so far (the frame's end position).
 */
export class FrameCollector {
  private readonly frameSize: number
  private readonly hopSize: number
  private readonly onFrame: (frame: Float32Array, endSample: number) => void
  private readonly buffer: Float32Array
  private position = 0
  private total = 0

  constructor(
    frameSize: number,
    hopSize: number,
    onFrame: (frame: Float32Array, endSample: number) => void,
  ) {
    this.frameSize = frameSize
    this.hopSize = hopSize
    this.onFrame = onFrame
    this.buffer = new Float32Array(frameSize)
  }

  push(block: Float32Array): void {
    for (let i = 0; i < block.length; i++) {
      this.buffer[this.position] = block[i]
      this.position = (this.position + 1) % this.frameSize
      this.total++
      if (this.total >= this.frameSize && (this.total - this.frameSize) % this.hopSize === 0) {
        this.emit()
      }
    }
  }

  private emit(): void {
    const frame = new Float32Array(this.frameSize)
    const tail = this.buffer.subarray(this.position)
    frame.set(tail, 0)
    frame.set(this.buffer.subarray(0, this.position), tail.length)
    this.onFrame(frame, this.total)
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/test-support/synth.ts src/analysis
git commit -m "feat: high-pass filter, frame collector and synthetic test signals"
```

---

### Task 5: Frame analyzer and offline analysis

**Files:**
- Create: `src/analysis/frame-analyzer.ts`, `src/analysis/offline.ts`
- Test: `src/analysis/frame-analyzer.test.ts`

**Interfaces:**
- Consumes: `FRAME_SIZE`, `HOP_SIZE`, `FrameCollector`, `HIGH_PASS_HZ`, `HighPassFilter` (Task 4).
- Produces:
  - `interface FrameAnalysis { hz: number | null; clarity: number; rmsDb: number }`, `interface TimedFrame extends FrameAnalysis { timeMs }`
  - `MIN_PITCH_HZ = 180`, `MAX_PITCH_HZ = 2100`, `rmsDb(samples)`
  - `type FrameAnalyzer`, `createFrameAnalyzer(frameSize, levelWindow): FrameAnalyzer`. `rmsDb` covers only the newest `levelWindow` samples (512), so bow-change dips are not smeared across the whole 43 ms frame.
  - `analyzeSignal(samples, sampleRate): TimedFrame[]` (filter, frame and analyze, exactly as the live path does)

Measured with this code: violin-like tones from G3 to B5 are within 0.2 cents, with no octave errors when the fundamental is weak. Rumble as loud as the violin gives *no* pitch rather than a wrong one.

- [ ] **Step 1: Install pitchy**

Run: `npm install pitchy@^4.1.0`

- [ ] **Step 2: Write the failing test**

`src/analysis/frame-analyzer.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { createFrameAnalyzer, rmsDb } from './frame-analyzer'
import { analyzeSignal } from './offline'
import { centsBetween, midiToHz } from '../music/pitch'
import {
  SAMPLE_RATE,
  VIOLIN_HARMONICS,
  WEAK_FUNDAMENTAL_HARMONICS,
  mix,
  noise,
  rumble,
  silence,
  tone,
} from '../test-support/synth'

/** Frames from the steady middle of a 500 ms tone (skips attack and release). */
function steadyFrames(signal: Float32Array) {
  return analyzeSignal(signal, SAMPLE_RATE).slice(5, -5)
}

describe('rmsDb', () => {
  test('full-scale sine is about -3 dBFS; silence is the floor', () => {
    expect(rmsDb(tone({ hz: 440, ms: 100, amplitude: 1, attackMs: 0, releaseMs: 0 }))).toBeCloseTo(-3.01, 1)
    expect(rmsDb(new Float32Array(2048))).toBe(-120)
  })
})

describe('frame analyzer', () => {
  test('violin-like tones across first position are within 1 cent', () => {
    for (let midi = 55; midi <= 83; midi++) {
      const hz = midiToHz(midi)
      for (const f of steadyFrames(tone({ hz, ms: 500, harmonics: VIOLIN_HARMONICS }))) {
        expect(f.hz).not.toBeNull()
        expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(1)
        expect(f.clarity).toBeGreaterThan(0.95)
      }
    }
  })

  test('no octave error on G-string notes with a weak fundamental', () => {
    for (const midi of [55, 56, 57, 58, 59, 60, 61, 62]) {
      const hz = midiToHz(midi)
      for (const f of steadyFrames(tone({ hz, ms: 500, harmonics: WEAK_FUNDAMENTAL_HARMONICS }))) {
        expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(1)
      }
    }
  })

  test('a detuned tone is measured as detuned', () => {
    const hz = midiToHz(69) * 2 ** (30 / 1200)
    for (const f of steadyFrames(tone({ hz, ms: 500, harmonics: VIOLIN_HARMONICS }))) {
      expect(centsBetween(f.hz!, midiToHz(69))).toBeCloseTo(30, 0)
    }
  })

  test('silence, white noise and rumble alone give no pitch', () => {
    for (const signal of [silence(500), noise(500, 0.05), rumble(500, 0.3)]) {
      for (const f of analyzeSignal(signal, SAMPLE_RATE)) expect(f.hz).toBeNull()
    }
  })

  test('rumble at half the violin level does not disturb the pitch', () => {
    for (const [hz, harmonics] of [
      [440, VIOLIN_HARMONICS],
      [196, WEAK_FUNDAMENTAL_HARMONICS],
    ] as const) {
      const signal = mix(tone({ hz, ms: 500, harmonics: [...harmonics], amplitude: 0.1 }), rumble(500, 0.05))
      for (const f of steadyFrames(signal)) {
        expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(5)
        expect(f.clarity).toBeGreaterThan(0.9)
      }
    }
  })

  test('PRECISION: rumble louder than the violin never produces a wrong pitch', () => {
    const signal = mix(tone({ hz: 440, ms: 500, harmonics: VIOLIN_HARMONICS, amplitude: 0.1 }), rumble(500, 0.2))
    for (const f of steadyFrames(signal)) {
      if (f.hz !== null) expect(Math.abs(centsBetween(f.hz, 440))).toBeLessThan(5)
    }
  })

  test('a clipped (too loud) tone is still measured at the right pitch', () => {
    const loud = tone({ hz: 440, ms: 500, harmonics: VIOLIN_HARMONICS, amplitude: 3 }).map((x) => Math.max(-1, Math.min(1, x)))
    for (const f of steadyFrames(loud)) expect(Math.abs(centsBetween(f.hz!, 440))).toBeLessThan(1)
  })

  test('pitches outside the violin range are reported as null', () => {
    const analyze = createFrameAnalyzer(2048, 512)
    const low = tone({ hz: 120, ms: 100, attackMs: 0, releaseMs: 0 }).subarray(0, 2048)
    expect(analyze(low, SAMPLE_RATE).hz).toBeNull()
  })

  test('works at 44.1 kHz as well as 48 kHz', () => {
    const sr = 44100
    const frames = analyzeSignal(tone({ hz: 440, ms: 500, harmonics: VIOLIN_HARMONICS }, sr), sr).slice(5, -5)
    for (const f of frames) expect(Math.abs(centsBetween(f.hz!, 440))).toBeLessThan(1)
    expect(frames[1].timeMs - frames[0].timeMs).toBeCloseTo((512 / sr) * 1000, 6)
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/analysis/frame-analyzer.test.ts`
Expected: FAIL, `Failed to resolve import "./frame-analyzer"`.

- [ ] **Step 4: Implement**

`src/analysis/frame-analyzer.ts`:

```ts
import { PitchDetector } from 'pitchy'

export interface FrameAnalysis {
  /** Detected fundamental, or null when there is no usable pitch in the violin range. */
  hz: number | null
  /** McLeod clarity, 0..1 (0 when hz is null). */
  clarity: number
  /** Level of the newest `levelWindow` samples in dBFS (short, so bow-change dips show up). */
  rmsDb: number
}

export interface TimedFrame extends FrameAnalysis {
  timeMs: number
}

/** Below open G (196 Hz) by more than a semitone; above anything a beginner plays. */
export const MIN_PITCH_HZ = 180
export const MAX_PITCH_HZ = 2100
const SILENCE_DB = -120

export function rmsDb(frame: Float32Array): number {
  let sum = 0
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
  const rms = Math.sqrt(sum / frame.length)
  return rms > 0 ? Math.max(SILENCE_DB, 20 * Math.log10(rms)) : SILENCE_DB
}

export type FrameAnalyzer = (frame: Float32Array, sampleRate: number) => FrameAnalysis

export function createFrameAnalyzer(frameSize: number, levelWindow: number): FrameAnalyzer {
  const detector = PitchDetector.forFloat32Array(frameSize)
  return (frame, sampleRate) => {
    const level = rmsDb(frame.subarray(frame.length - levelWindow))
    const [hz, clarity] = detector.findPitch(frame, sampleRate)
    if (!Number.isFinite(hz) || hz < MIN_PITCH_HZ || hz > MAX_PITCH_HZ) {
      return { hz: null, clarity: 0, rmsDb: level }
    }
    return { hz, clarity, rmsDb: level }
  }
}
```

`src/analysis/offline.ts` (Task 6 adds `trackNotes` to this file):

```ts
import { FRAME_SIZE, FrameCollector, HOP_SIZE } from './frame-collector'
import { createFrameAnalyzer, type TimedFrame } from './frame-analyzer'
import { HIGH_PASS_HZ, HighPassFilter } from './highpass'

/** Runs a whole recording through the same steps as the live microphone path. */
export function analyzeSignal(samples: Float32Array, sampleRate: number): TimedFrame[] {
  const filtered = new HighPassFilter(HIGH_PASS_HZ, sampleRate).process(samples)
  const analyze = createFrameAnalyzer(FRAME_SIZE, HOP_SIZE)
  const frames: TimedFrame[] = []
  const collector = new FrameCollector(FRAME_SIZE, HOP_SIZE, (frame, endSample) => {
    frames.push({ ...analyze(frame, sampleRate), timeMs: (endSample / sampleRate) * 1000 })
  })
  collector.push(filtered)
  return frames
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/analysis
git commit -m "feat: per-frame pitch, clarity and level analysis"
```

---

### Task 6: Note tracker

**Files:**
- Create: `src/analysis/note-tracker.ts`
- Modify: `src/analysis/offline.ts` (add `trackNotes`)
- Test: `src/analysis/note-tracker.test.ts`

**Interfaces:**
- Consumes: `FrameAnalysis`, `TimedFrame` (Task 5); `centsBetween` (Task 1).
- Produces:
  - `interface TrackerConfig { noiseFloorDb; minClarity; minLevelAboveNoiseDb; stabilityCents; minStableMs; reattackMs; reattackDipDb }`
  - `DEFAULT_TRACKER_CONFIG: Omit<TrackerConfig, 'noiseFloorDb'>`
  - `interface NoteEvent { hz; startMs; timeMs }`
  - `isVoiced(frame, config): boolean`, `median(values): number`
  - `class NoteTracker { constructor(config); push(frame, timeMs): NoteEvent | null }`
  - `trackNotes(frames, config): NoteEvent[]` in `offline.ts`

Rules: each played note gives exactly one event. A new event needs either a pitch move beyond ±25 cents, or a re-attack: at least 30 ms of silence or of a dip (level ≥ 6 dB below the note's peak, or unvoiced frames), followed by recovery. These rules came out of prototyping:
- A dip measured over whole frames was invisible.
- Unvoiced frames inside a bow change have to count toward the dip.

- [ ] **Step 1: Write the failing test**

`src/analysis/note-tracker.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { DEFAULT_TRACKER_CONFIG, median, type TrackerConfig } from './note-tracker'
import { analyzeSignal, trackNotes } from './offline'
import { centsBetween, midiToHz } from '../music/pitch'
import { SAMPLE_RATE, VIOLIN_HARMONICS, concat, noise, silence, tone } from '../test-support/synth'

const QUIET_ROOM: TrackerConfig = { ...DEFAULT_TRACKER_CONFIG, noiseFloorDb: -70 }
const A4 = midiToHz(69)
const B4 = midiToHz(71)

function play(signal: Float32Array, config = QUIET_ROOM) {
  return trackNotes(analyzeSignal(signal, SAMPLE_RATE), config)
}

function violin(hz: number, ms: number, extra: Partial<Parameters<typeof tone>[0]> = {}) {
  return tone({ hz, ms, harmonics: VIOLIN_HARMONICS, ...extra })
}

describe('median', () => {
  test('odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('NoteTracker', () => {
  test('one steady note gives exactly one event, after the stability window', () => {
    const events = play(concat(silence(100), violin(A4, 500), silence(100)))
    expect(events).toHaveLength(1)
    expect(Math.abs(centsBetween(events[0].hz, A4))).toBeLessThan(1)
    const confirmDelay = events[0].timeMs - events[0].startMs
    expect(confirmDelay).toBeGreaterThanOrEqual(120)
    expect(confirmDelay).toBeLessThan(135)
  })

  test('two different notes played legato give two events', () => {
    const events = play(concat(violin(A4, 400, { releaseMs: 0 }), violin(B4, 400, { attackMs: 0 })))
    expect(events.map((e) => Math.round(centsBetween(e.hz, A4) / 100))).toEqual([0, 2])
  })

  test('the same note twice with a short silence gives two events', () => {
    const events = play(concat(violin(A4, 300), silence(50), violin(A4, 300)))
    expect(events).toHaveLength(2)
  })

  function withDip(ms: number, amplitude: number) {
    const dip = violin(A4, ms, { amplitude, attackMs: 0, releaseMs: 0 })
    return concat(violin(A4, 300, { releaseMs: 0 }), dip, violin(A4, 300, { attackMs: 0 }))
  }

  test('the same note twice with a level dip (bow change) gives two events', () => {
    expect(play(withDip(40, 0.1))).toHaveLength(2) // 10 dB dip
    expect(play(withDip(40, 0.01))).toHaveLength(2) // so deep that pitch is lost for a moment
  })

  test('a dip shorter than the re-attack time is not a new note', () => {
    expect(play(withDip(20, 0.03))).toHaveLength(1)
  })

  test('a held note without a dip stays one event', () => {
    expect(play(violin(A4, 800))).toHaveLength(1)
  })

  test('a short blip is ignored', () => {
    expect(play(concat(silence(100), violin(A4, 60), silence(100)))).toHaveLength(0)
  })

  test('a slide between two notes gives only the two held notes', () => {
    const signal = concat(
      violin(A4, 300, { releaseMs: 0 }),
      violin(A4, 300, { endHz: B4, attackMs: 0, releaseMs: 0 }),
      violin(B4, 300, { attackMs: 0 }),
    )
    const events = play(signal)
    expect(events).toHaveLength(2)
    expect(Math.abs(centsBetween(events[0].hz, A4))).toBeLessThan(5)
    expect(Math.abs(centsBetween(events[1].hz, B4))).toBeLessThan(5)
  })

  test('a narrow vibrato (up to ±12 cents) stays one note, measured near its center', () => {
    const events = play(violin(A4, 600, { vibrato: { rateHz: 6, widthCents: 12 } }))
    expect(events).toHaveLength(1)
    expect(Math.abs(centsBetween(events[0].hz, A4))).toBeLessThan(10)
  })

  test('sound not clearly above the noise floor is ignored', () => {
    const noisyRoom: TrackerConfig = { ...DEFAULT_TRACKER_CONFIG, noiseFloorDb: -40 }
    expect(play(violin(A4, 500, { amplitude: 0.01 }), noisyRoom)).toHaveLength(0) // about -45 dBFS
  })

  test('noise alone produces no notes', () => {
    expect(play(noise(1000, 0.1))).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/analysis/note-tracker.test.ts`
Expected: FAIL, `Failed to resolve import "./note-tracker"`.

- [ ] **Step 3: Implement**

`src/analysis/note-tracker.ts`:

```ts
import { centsBetween } from '../music/pitch'
import type { FrameAnalysis } from './frame-analyzer'

export interface TrackerConfig {
  /** Level of the room without playing, from the microphone check (dBFS). */
  noiseFloorDb: number
  minClarity: number
  minLevelAboveNoiseDb: number
  /** Frames must stay within this many cents of the run's median to count as one stable note. */
  stabilityCents: number
  minStableMs: number
  /** Silence or dip duration that separates two notes of the same pitch. */
  reattackMs: number
  reattackDipDb: number
}

export const DEFAULT_TRACKER_CONFIG: Omit<TrackerConfig, 'noiseFloorDb'> = {
  minClarity: 0.9,
  minLevelAboveNoiseDb: 12,
  stabilityCents: 25,
  minStableMs: 120,
  reattackMs: 30,
  reattackDipDb: 6,
}

export interface NoteEvent {
  /** Median pitch over the stable window. */
  hz: number
  /** When the run of stable frames began. */
  startMs: number
  /** When the note was confirmed (startMs + at least minStableMs). */
  timeMs: number
}

const MEDIAN_WINDOW = 32

export function isVoiced(frame: FrameAnalysis, config: TrackerConfig): boolean {
  return (
    frame.hz !== null &&
    frame.clarity >= config.minClarity &&
    frame.rmsDb >= config.noiseFloorDb + config.minLevelAboveNoiseDb
  )
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

interface Run {
  startMs: number
  pitches: number[]
  peakDb: number
  emitted: boolean
  dipSinceMs: number | null
  dipped: boolean
}

/**
 * Turns analyzed frames into note events. Each played note produces exactly one event:
 * a new event needs a pitch change, or a re-attack (silence or a level dip, then a rise).
 */
export class NoteTracker {
  private readonly config: TrackerConfig
  private run: Run | null = null
  private unvoicedSinceMs: number | null = null

  constructor(config: TrackerConfig) {
    this.config = config
  }

  push(frame: FrameAnalysis, timeMs: number): NoteEvent | null {
    const c = this.config
    if (!isVoiced(frame, c)) {
      this.unvoicedSinceMs ??= timeMs
      if (this.run && timeMs - this.unvoicedSinceMs >= c.reattackMs) this.run = null
      else if (this.run?.emitted) this.markDip(this.run, timeMs)
      return null
    }
    this.unvoicedSinceMs = null
    const hz = frame.hz as number

    if (this.run === null || Math.abs(centsBetween(hz, median(this.run.pitches))) > c.stabilityCents) {
      this.run = newRun(hz, frame.rmsDb, timeMs)
    } else if (this.run.emitted) {
      if (this.detectReattack(this.run, frame.rmsDb, timeMs)) this.run = newRun(hz, frame.rmsDb, timeMs)
      else this.addPitch(this.run, hz)
    } else {
      this.addPitch(this.run, hz)
      this.run.peakDb = Math.max(this.run.peakDb, frame.rmsDb)
    }

    const run = this.run
    if (!run.emitted && timeMs - run.startMs >= c.minStableMs) {
      run.emitted = true
      return { hz: median(run.pitches), startMs: run.startMs, timeMs }
    }
    return null
  }

  /** Tracks level dips within a sounding note; true when the level comes back after a long enough dip. */
  private detectReattack(run: Run, levelDb: number, timeMs: number): boolean {
    if (levelDb < run.peakDb - this.config.reattackDipDb) {
      this.markDip(run, timeMs)
      return false
    }
    const recovered = run.dipped
    run.dipSinceMs = null
    run.dipped = false
    run.peakDb = Math.max(run.peakDb, levelDb)
    return recovered
  }

  /** Low or unvoiced frames inside a sounding note both count toward a dip. */
  private markDip(run: Run, timeMs: number): void {
    run.dipSinceMs ??= timeMs
    if (timeMs - run.dipSinceMs >= this.config.reattackMs) run.dipped = true
  }

  private addPitch(run: Run, hz: number): void {
    run.pitches.push(hz)
    if (run.emitted && run.pitches.length > MEDIAN_WINDOW) run.pitches.shift()
  }
}

function newRun(hz: number, levelDb: number, timeMs: number): Run {
  return { startMs: timeMs, pitches: [hz], peakDb: levelDb, emitted: false, dipSinceMs: null, dipped: false }
}
```

Replace `src/analysis/offline.ts` with:

```ts
import { FRAME_SIZE, FrameCollector, HOP_SIZE } from './frame-collector'
import { createFrameAnalyzer, type TimedFrame } from './frame-analyzer'
import { HIGH_PASS_HZ, HighPassFilter } from './highpass'
import { NoteTracker, type NoteEvent, type TrackerConfig } from './note-tracker'

/** Runs a whole recording through the same steps as the live microphone path. */
export function analyzeSignal(samples: Float32Array, sampleRate: number): TimedFrame[] {
  const filtered = new HighPassFilter(HIGH_PASS_HZ, sampleRate).process(samples)
  const analyze = createFrameAnalyzer(FRAME_SIZE, HOP_SIZE)
  const frames: TimedFrame[] = []
  const collector = new FrameCollector(FRAME_SIZE, HOP_SIZE, (frame, endSample) => {
    frames.push({ ...analyze(frame, sampleRate), timeMs: (endSample / sampleRate) * 1000 })
  })
  collector.push(filtered)
  return frames
}

/** Feeds analyzed frames through a fresh note tracker. */
export function trackNotes(frames: readonly TimedFrame[], config: TrackerConfig): NoteEvent[] {
  const tracker = new NoteTracker(config)
  const events: NoteEvent[] = []
  for (const f of frames) {
    const event = tracker.push(f, f.timeMs)
    if (event) events.push(event)
  }
  return events
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analysis
git commit -m "feat: note tracker with stability window and re-attack detection"
```

---

### Task 7: Wait-mode session and scoring

**Files:**
- Create: `src/practice/wait-session.ts`, `src/practice/scoring.ts`
- Test: `src/practice/wait-session.test.ts`, `src/practice/scoring.test.ts`

**Interfaces:**
- Consumes: `judge`, `Judgement`, `Tolerances`, `DEFAULT_TOLERANCES`, `midiToHz` (Task 1); `defaultFingering` (Task 2); `Exercise`, `Target` (Task 3).
- Produces:
  - `type TargetColor = 'green' | 'yellow'`
  - `interface TargetState { color: TargetColor | null; redAttempts; centsAtAcceptance: number | null; hintVisible }`
  - `interface SessionConfig { tolerances; a4Hz; hintDelayMs; initialHint: (target: Target) => boolean }`, `DEFAULT_HINT_DELAY_MS = 5000`
  - `interface WaitSessionState { exercise; config; cursor; targets: TargetState[]; activeSinceMs; finished }`
  - `type SessionEvent` (`accepted`, `rejected`, `hintShown`, `finished`), `interface Step { state; events }`
  - `startSession(exercise, config, nowMs)`, `onNote(state, { hz, timeMs }): Step`, `onTick(state, nowMs): Step`
  - `type Stars = 0 | 1 | 2 | 3`, `interface RunResult { points; maxPoints; stars }`, `targetPoints(t)`, `scoreRun(targets, completed)`

`initialHint` is how plan 2 plugs in persisted hint fading (hide hints for learned note keys). In this plan, the app passes `() => true`.

- [ ] **Step 1: Write the failing tests**

`src/practice/wait-session.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
import { defaultFingering } from '../music/fingering'
import { DEFAULT_TOLERANCES, midiToHz } from '../music/pitch'
import type { Exercise } from '../score/exercise'
import { DEFAULT_HINT_DELAY_MS, onNote, onTick, startSession, type SessionConfig } from './wait-session'

function exerciseOf(midis: number[]): Exercise {
  return {
    title: 'test',
    abc: '',
    preferFlats: false,
    targets: midis.map((midi, index) => ({
      index,
      midi,
      durationWhole: 0.25,
      fingering: defaultFingering(midi),
      sourceStart: index,
    })),
  }
}

const config: SessionConfig = {
  tolerances: DEFAULT_TOLERANCES,
  a4Hz: 440,
  hintDelayMs: DEFAULT_HINT_DELAY_MS,
  initialHint: () => false,
}

const G4 = 67
const A4 = 69
const detune = (midi: number, cents: number) => midiToHz(midi) * 2 ** (cents / 1200)

describe('wait session', () => {
  test('the cursor advances only on the correct note', () => {
    let s = startSession(exerciseOf([G4, A4]), config, 0)
    let step = onNote(s, { hz: midiToHz(70), timeMs: 100 }) // A#4: wrong
    expect(step.state.cursor).toBe(0)
    expect(step.events[0]).toMatchObject({ type: 'rejected', index: 0, judgement: { kind: 'wrongNote', playedMidi: 70 } })
    s = step.state
    step = onNote(s, { hz: midiToHz(G4), timeMs: 200 })
    expect(step.state.cursor).toBe(1)
    expect(step.events[0]).toMatchObject({ type: 'accepted', index: 0, color: 'green' })
  })

  test('yellow advances and is recorded as yellow', () => {
    const step = onNote(startSession(exerciseOf([A4]), config, 0), { hz: detune(A4, 28), timeMs: 10 })
    expect(step.state.targets[0].color).toBe('yellow')
    expect(step.state.targets[0].centsAtAcceptance).toBeCloseTo(28, 6)
  })

  test('out of tune does not advance', () => {
    const step = onNote(startSession(exerciseOf([A4]), config, 0), { hz: detune(A4, -40), timeMs: 10 })
    expect(step.state.cursor).toBe(0)
    expect(step.events[0]).toMatchObject({ type: 'rejected', judgement: { kind: 'outOfTune' } })
  })

  test('red attempts are counted and reveal the hint', () => {
    let s = startSession(exerciseOf([A4]), config, 0)
    expect(s.targets[0].hintVisible).toBe(false)
    const step = onNote(s, { hz: midiToHz(71), timeMs: 10 })
    expect(step.events.map((e) => e.type)).toEqual(['rejected', 'hintShown'])
    s = step.state
    expect(s.targets[0]).toMatchObject({ redAttempts: 1, hintVisible: true })
    s = onNote(s, { hz: midiToHz(72), timeMs: 20 }).state
    expect(s.targets[0].redAttempts).toBe(2)
  })

  test('finishes after the last target', () => {
    let s = startSession(exerciseOf([G4, A4]), config, 0)
    s = onNote(s, { hz: midiToHz(G4), timeMs: 10 }).state
    const step = onNote(s, { hz: midiToHz(A4), timeMs: 20 })
    expect(step.state.finished).toBe(true)
    expect(step.events.map((e) => e.type)).toEqual(['accepted', 'finished'])
    expect(onNote(step.state, { hz: midiToHz(A4), timeMs: 30 }).events).toEqual([])
  })

  test('the hint appears after the delay without a correct note', () => {
    const s = startSession(exerciseOf([A4]), config, 1000)
    expect(onTick(s, 1000 + DEFAULT_HINT_DELAY_MS - 1).events).toEqual([])
    const step = onTick(s, 1000 + DEFAULT_HINT_DELAY_MS)
    expect(step.events).toEqual([{ type: 'hintShown', index: 0 }])
    expect(onTick(step.state, 99999).events).toEqual([])
  })

  test('the hint delay restarts when the cursor moves', () => {
    let s = startSession(exerciseOf([G4, A4]), config, 0)
    s = onNote(s, { hz: midiToHz(G4), timeMs: 4000 }).state
    expect(onTick(s, 6000).events).toEqual([])
    expect(onTick(s, 9000).events).toEqual([{ type: 'hintShown', index: 1 }])
  })

  test('notes without a fingering never show a hint', () => {
    let s = startSession(exerciseOf([90]), { ...config, initialHint: () => true }, 0)
    expect(s.targets[0].hintVisible).toBe(false)
    expect(onTick(s, 99999).events).toEqual([])
    s = onNote(s, { hz: midiToHz(89), timeMs: 10 }).state
    expect(s.targets[0].hintVisible).toBe(false)
  })

  test('initialHint decides the starting hints', () => {
    const s = startSession(exerciseOf([G4, A4]), { ...config, initialHint: (t) => t.midi === A4 }, 0)
    expect(s.targets.map((t) => t.hintVisible)).toEqual([false, true])
  })

  test('uses the configured A4 reference', () => {
    const at442 = { ...config, a4Hz: 442 }
    const step = onNote(startSession(exerciseOf([A4]), at442, 0), { hz: 442, timeMs: 10 })
    expect(step.state.targets[0].color).toBe('green')
  })

  test('PROPERTY: the cursor never passes a target without a green or yellow acceptance', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 55, max: 83 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.tuple(fc.integer({ min: 50, max: 90 }), fc.double({ min: -60, max: 60, noNaN: true }))),
        (midis, played) => {
          let s = startSession(exerciseOf(midis), config, 0)
          played.forEach(([midi, cents], i) => {
            const before = s.cursor
            s = onNote(s, { hz: detune(midi, cents), timeMs: i * 100 }).state
            if (s.cursor > before) {
              const t = s.targets[before]
              expect(t.color).not.toBeNull()
              expect(Math.abs(t.centsAtAcceptance!)).toBeLessThanOrEqual(DEFAULT_TOLERANCES.yellowCents)
              expect(midi + Math.round(cents / 100)).toBe(midis[before])
            }
          })
        },
      ),
    )
  })
})
```

`src/practice/scoring.test.ts`:

```ts
import { expect, test } from 'vitest'
import { scoreRun, targetPoints } from './scoring'
import type { TargetState } from './wait-session'

function t(color: TargetState['color'], redAttempts = 0): TargetState {
  return { color, redAttempts, centsAtAcceptance: color ? 0 : null, hintVisible: false }
}

test('points per target', () => {
  expect(targetPoints(t('green'))).toBe(2)
  expect(targetPoints(t('yellow'))).toBe(1)
  expect(targetPoints(t('green', 1))).toBe(1) // accepted after a red attempt
  expect(targetPoints(t('yellow', 3))).toBe(1)
  expect(targetPoints(t(null))).toBe(0)
})

test('3 stars at exactly 90%', () => {
  const targets = [...Array(9).fill(t('green')), t('yellow'), ...Array(5).fill(t('green'))] // 29/30
  expect(scoreRun(targets, true).stars).toBe(3)
  const exactly90 = [...Array(8).fill(t('green')), t('yellow'), t('yellow')] // 18/20
  expect(scoreRun(exactly90, true)).toEqual({ points: 18, maxPoints: 20, stars: 3 })
})

test('2 stars at exactly 70%, 1 star below', () => {
  const exactly70 = [...Array(4).fill(t('green')), ...Array(6).fill(t('yellow'))] // 14/20
  expect(scoreRun(exactly70, true).stars).toBe(2)
  const below = [...Array(3).fill(t('green')), ...Array(7).fill(t('yellow'))] // 13/20
  expect(scoreRun(below, true).stars).toBe(1)
})

test('an unfinished run earns no stars', () => {
  expect(scoreRun([t('green'), t(null)], false).stars).toBe(0)
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/practice`
Expected: FAIL, `Failed to resolve import "./wait-session"` and `"./scoring"`.

- [ ] **Step 3: Implement**

`src/practice/wait-session.ts`:

```ts
import { judge, type Judgement, type Tolerances } from '../music/pitch'
import type { Exercise, Target } from '../score/exercise'

export type TargetColor = 'green' | 'yellow'

export interface TargetState {
  color: TargetColor | null
  redAttempts: number
  centsAtAcceptance: number | null
  hintVisible: boolean
}

export interface SessionConfig {
  tolerances: Tolerances
  a4Hz: number
  /** Show the hint when the current target is not accepted within this time. */
  hintDelayMs: number
  /** Whether a target's hint is visible at the start (later: false for learned notes). */
  initialHint: (target: Target) => boolean
}

export const DEFAULT_HINT_DELAY_MS = 5000

export interface WaitSessionState {
  exercise: Exercise
  config: SessionConfig
  cursor: number
  targets: TargetState[]
  /** When the current target became current (audio clock, ms). */
  activeSinceMs: number
  finished: boolean
}

export type SessionEvent =
  | { type: 'accepted'; index: number; color: TargetColor; judgement: Judgement }
  | { type: 'rejected'; index: number; judgement: Judgement }
  | { type: 'hintShown'; index: number }
  | { type: 'finished' }

export interface Step {
  state: WaitSessionState
  events: SessionEvent[]
}

export function startSession(exercise: Exercise, config: SessionConfig, nowMs: number): WaitSessionState {
  return {
    exercise,
    config,
    cursor: 0,
    targets: exercise.targets.map((t) => ({
      color: null,
      redAttempts: 0,
      centsAtAcceptance: null,
      hintVisible: t.fingering !== null && config.initialHint(t),
    })),
    activeSinceMs: nowMs,
    finished: false,
  }
}

/** A confirmed note from the note tracker. */
export function onNote(state: WaitSessionState, note: { hz: number; timeMs: number }): Step {
  if (state.finished) return { state, events: [] }
  const index = state.cursor
  const target = state.exercise.targets[index]
  const current = state.targets[index]
  const judgement = judge(note.hz, target.midi, state.config.tolerances, state.config.a4Hz)
  const targets = [...state.targets]

  if (judgement.kind === 'green' || judgement.kind === 'yellow') {
    targets[index] = { ...current, color: judgement.kind, centsAtAcceptance: judgement.cents }
    const cursor = index + 1
    const finished = cursor === state.exercise.targets.length
    const events: SessionEvent[] = [{ type: 'accepted', index, color: judgement.kind, judgement }]
    if (finished) events.push({ type: 'finished' })
    return { state: { ...state, targets, cursor, finished, activeSinceMs: note.timeMs }, events }
  }

  const events: SessionEvent[] = [{ type: 'rejected', index, judgement }]
  const showHint = target.fingering !== null && !current.hintVisible
  targets[index] = { ...current, redAttempts: current.redAttempts + 1, hintVisible: current.hintVisible || showHint }
  if (showHint) events.push({ type: 'hintShown', index })
  return { state: { ...state, targets }, events }
}

/** Called regularly with the audio clock; reveals the hint after the delay. */
export function onTick(state: WaitSessionState, nowMs: number): Step {
  if (state.finished) return { state, events: [] }
  const index = state.cursor
  const current = state.targets[index]
  const hasHint = state.exercise.targets[index].fingering !== null
  if (current.hintVisible || !hasHint || nowMs - state.activeSinceMs < state.config.hintDelayMs) {
    return { state, events: [] }
  }
  const targets = [...state.targets]
  targets[index] = { ...current, hintVisible: true }
  return { state: { ...state, targets }, events: [{ type: 'hintShown', index }] }
}
```

`src/practice/scoring.ts`:

```ts
import type { TargetState } from './wait-session'

export type Stars = 0 | 1 | 2 | 3

export interface RunResult {
  points: number
  maxPoints: number
  stars: Stars
}

/** Green 2, yellow 1; a target accepted after a red attempt earns at most 1. */
export function targetPoints(t: TargetState): number {
  if (t.color === null) return 0
  const base = t.color === 'green' ? 2 : 1
  return t.redAttempts > 0 ? Math.min(base, 1) : base
}

/** Stars: 3 at >= 90% of the points, 2 at >= 70%, 1 for finishing; 0 when not finished. */
export function scoreRun(targets: readonly TargetState[], completed: boolean): RunResult {
  const points = targets.reduce((sum, t) => sum + targetPoints(t), 0)
  const maxPoints = 2 * targets.length
  let stars: Stars = 0
  if (completed) {
    // Integer comparisons avoid floating-point edge cases at exactly 90% and 70%.
    if (points * 10 >= maxPoints * 9) stars = 3
    else if (points * 10 >= maxPoints * 7) stars = 2
    else stars = 1
  }
  return { points, maxPoints, stars }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice
git commit -m "feat: wait-mode session state machine and star scoring"
```

---

### Task 8: Practice engine (noise check, needle, synthetic performances)

**Files:**
- Create: `src/analysis/level.ts`, `src/analysis/pitch-smoother.ts`, `src/practice/engine.ts`
- Test: `src/analysis/level.test.ts`, `src/analysis/pitch-smoother.test.ts`, `src/practice/engine.test.ts`

**Interfaces:**
- Consumes: `TimedFrame` (Task 5); `NoteTracker`, `DEFAULT_TRACKER_CONFIG`, `isVoiced`, `median`, `TrackerConfig` (Task 6); `startSession`, `onNote`, `onTick`, `SessionConfig`, `WaitSessionState`, `scoreRun`, `RunResult` (Task 7); `parseExercise` (Task 3); pitch helpers (Task 1); `analyzeSignal` and `synth` (Tasks 4–5).
- Produces:
  - `MAX_NOISE_FLOOR_DB = -50`, `NOISE_CHECK_MS = 2000`, `noiseFloorDb(levels)`, `isTooNoisy(floorDb)`
  - `class PitchSmoother { constructor(windowMs?); push(hz | null, timeMs): number | null }`
  - `type EnginePhase = 'measuringNoise' | 'tooNoisy' | 'practicing' | 'finished'`
  - `interface NeedleReading { cents; playedName: string | null }`, `interface Rejection { index; kind; playedName }`
  - `interface EngineSnapshot { phase; noiseCheckProgress; noiseFloorDb; session; needle; lastRejection; result }`
  - `class PracticeEngine { constructor(session: WaitSessionState); handleFrame(frame: TimedFrame); snapshot(): EngineSnapshot }`

`engine.test.ts` is the synthetic performance suite from spec section 9.2. Whole exercises are played as generated audio through the real analysis code.

- [ ] **Step 1: Write the failing tests**

`src/analysis/level.test.ts`:

```ts
import { expect, test } from 'vitest'
import { MAX_NOISE_FLOOR_DB, isTooNoisy, noiseFloorDb } from './level'

test('noise floor is the 90th percentile, so a single click does not count', () => {
  const levels = [-80, -79, -81, -80, -78, -80, -79, -80, -81, -20]
  expect(noiseFloorDb(levels)).toBe(-78)
})

test('an empty list is a programming error', () => {
  expect(() => noiseFloorDb([])).toThrow()
})

test('too noisy above the limit', () => {
  expect(isTooNoisy(MAX_NOISE_FLOOR_DB + 1)).toBe(true)
  expect(isTooNoisy(MAX_NOISE_FLOOR_DB)).toBe(false)
  expect(isTooNoisy(-70)).toBe(false)
})
```

`src/analysis/pitch-smoother.test.ts`:

```ts
import { expect, test } from 'vitest'
import { PitchSmoother } from './pitch-smoother'

test('returns the median of the recent window', () => {
  const s = new PitchSmoother(100)
  expect(s.push(440, 0)).toBe(440)
  expect(s.push(450, 10)).toBe(445)
  expect(s.push(441, 20)).toBe(441)
})

test('forgets values older than the window', () => {
  const s = new PitchSmoother(100)
  s.push(400, 0)
  s.push(400, 10)
  expect(s.push(440, 105)).toBe(420) // 400 at t=10 and 440 at t=105
  expect(s.push(440, 115)).toBe(440)
})

test('an unvoiced frame clears the needle', () => {
  const s = new PitchSmoother(100)
  s.push(440, 0)
  expect(s.push(null, 10)).toBeNull()
  expect(s.push(330, 20)).toBe(330)
})
```

`src/practice/engine.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { analyzeSignal } from '../analysis/offline'
import { DEFAULT_TOLERANCES, midiToHz } from '../music/pitch'
import { parseExercise } from '../score/abc'
import type { Exercise } from '../score/exercise'
import {
  SAMPLE_RATE,
  VIOLIN_HARMONICS,
  WEAK_FUNDAMENTAL_HARMONICS,
  concat,
  mix,
  noise,
  rumble,
  silence,
  tone,
} from '../test-support/synth'
import { PracticeEngine } from './engine'
import { DEFAULT_HINT_DELAY_MS, startSession, type SessionConfig } from './wait-session'

const config: SessionConfig = {
  tolerances: DEFAULT_TOLERANCES,
  a4Hz: 440,
  hintDelayMs: DEFAULT_HINT_DELAY_MS,
  initialHint: () => true,
}

function exercise(body: string): Exercise {
  const r = parseExercise(`X:1\nT:t\nM:4/4\nL:1/4\nK:D\n${body}`)
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.exercise
}

/** A quiet room for the microphone check (2.1 s), then the performance. */
function run(ex: Exercise, performance: Float32Array, room = silence(2100)) {
  const engine = new PracticeEngine(startSession(ex, config, 0))
  for (const f of analyzeSignal(concat(room, performance), SAMPLE_RATE)) engine.handleFrame(f)
  return engine.snapshot()
}

function note(midi: number, ms = 400, cents = 0, harmonics = VIOLIN_HARMONICS) {
  return concat(tone({ hz: midiToHz(midi) * 2 ** (cents / 1200), ms, harmonics }), silence(60))
}

describe('PracticeEngine with synthetic performances', () => {
  test('open strings played in tune: all green, 3 stars', () => {
    const ex = exercise('G, D A e |]')
    const s = run(ex, concat(note(55, 400, 0, WEAK_FUNDAMENTAL_HARMONICS), note(62), note(69), note(76)))
    expect(s.phase).toBe('finished')
    expect(s.session.targets.map((t) => t.color)).toEqual(['green', 'green', 'green', 'green'])
    expect(s.result).toEqual({ points: 8, maxPoints: 8, stars: 3 })
  })

  test('a wrong note is rejected, then the right note is accepted with a red marker', () => {
    const ex = exercise('A B |]')
    const s = run(ex, concat(note(69), note(72), note(71)))
    expect(s.phase).toBe('finished')
    expect(s.session.targets[1]).toMatchObject({ color: 'green', redAttempts: 1 })
    expect(s.result?.points).toBe(3)
  })

  test('PRECISION: a wrong note never advances the cursor', () => {
    const ex = exercise('A B |]')
    const s = run(ex, concat(note(69), note(72), note(70), note(73)))
    expect(s.phase).toBe('practicing')
    expect(s.session.cursor).toBe(1)
    expect(s.session.targets[1]).toMatchObject({ color: null, redAttempts: 3 })
    expect(s.lastRejection).toMatchObject({ index: 1, kind: 'wrongNote', playedName: 'C♯5' })
  })

  test('PRECISION: 40 cents sharp is out of tune and does not advance', () => {
    const s = run(exercise('A |]'), note(69, 400, 40))
    expect(s.session.cursor).toBe(0)
    expect(s.lastRejection).toMatchObject({ kind: 'outOfTune' })
  })

  test('28 cents flat is yellow', () => {
    const s = run(exercise('A |]'), note(69, 400, -28))
    expect(s.session.targets[0].color).toBe('yellow')
  })

  test('repeated notes need a re-attack: separated notes complete the exercise', () => {
    const s = run(exercise('A A A |]'), concat(note(69), note(69), note(69)))
    expect(s.phase).toBe('finished')
  })

  test('repeated notes held as one long sound only count once', () => {
    const s = run(exercise('A A |]'), tone({ hz: 440, ms: 1200, harmonics: VIOLIN_HARMONICS }))
    expect(s.session.cursor).toBe(1)
  })

  test('playing works with moderate traffic rumble and room noise', () => {
    const ex = exercise('D A |]')
    const performance = concat(note(62), note(69))
    const noisy = mix(performance, rumble(performance.length / 48, 0.02), noise(performance.length / 48, 0.001))
    const room = mix(rumble(2100, 0.0005), noise(2100, 0.0005))
    expect(run(ex, noisy, room).phase).toBe('finished')
  })

  test('a noisy room blocks practice', () => {
    const s = run(exercise('A |]'), note(69), noise(2100, 0.05))
    expect(s.phase).toBe('tooNoisy')
    expect(s.session.cursor).toBe(0)
  })

  test('playing during the room check blocks practice instead of measuring a wrong floor', () => {
    const s = run(exercise('A |]'), note(69), tone({ hz: 440, ms: 2100, harmonics: VIOLIN_HARMONICS }))
    expect(s.phase).toBe('tooNoisy')
  })

  test('works with a 44.1 kHz microphone', () => {
    const sr = 44100
    const engine = new PracticeEngine(startSession(exercise('D A |]'), config, 0))
    const performance = concat(
      silence(2100, sr),
      tone({ hz: midiToHz(62), ms: 400, harmonics: VIOLIN_HARMONICS }, sr),
      silence(60, sr),
      tone({ hz: midiToHz(69), ms: 400, harmonics: VIOLIN_HARMONICS }, sr),
      silence(60, sr),
    )
    for (const f of analyzeSignal(performance, sr)) engine.handleFrame(f)
    expect(engine.snapshot().phase).toBe('finished')
    expect(engine.snapshot().result?.stars).toBe(3)
  })

  test('the needle shows cents while a note sounds, and the played note name when far off', () => {
    const ex = exercise('A |]')
    const engine = new PracticeEngine(startSession(ex, config, 0))
    const frames = analyzeSignal(concat(silence(2100), tone({ hz: midiToHz(71), ms: 300 })), SAMPLE_RATE)
    let sawFarOff = false
    for (const f of frames) {
      engine.handleFrame(f)
      const needle = engine.snapshot().needle
      if (needle && needle.playedName === 'B4') sawFarOff = true
    }
    expect(sawFarOff).toBe(true)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/analysis/level.test.ts src/analysis/pitch-smoother.test.ts src/practice/engine.test.ts`
Expected: FAIL, unresolved imports `./level`, `./pitch-smoother`, `./engine`.

- [ ] **Step 3: Implement**

`src/analysis/level.ts`:

```ts
/** Practice is blocked when the room is louder than this (spec section 10). */
export const MAX_NOISE_FLOOR_DB = -50
/** How long the microphone check listens to the quiet room. */
export const NOISE_CHECK_MS = 2000

/** Noise floor = 90th percentile of the frame levels heard while nobody plays. */
export function noiseFloorDb(levelsDb: readonly number[]): number {
  if (levelsDb.length === 0) throw new Error('noiseFloorDb needs at least one level')
  const sorted = [...levelsDb].sort((a, b) => a - b)
  return sorted[Math.floor(0.9 * (sorted.length - 1))]
}

export function isTooNoisy(floorDb: number): boolean {
  return floorDb > MAX_NOISE_FLOOR_DB
}
```

`src/analysis/pitch-smoother.ts`:

```ts
import { median } from './note-tracker'

/** Median pitch over a short window, for the tuning needle. Resets on any unvoiced frame. */
export class PitchSmoother {
  private readonly windowMs: number
  private samples: { timeMs: number; hz: number }[] = []

  constructor(windowMs = 100) {
    this.windowMs = windowMs
  }

  push(hz: number | null, timeMs: number): number | null {
    if (hz === null) {
      this.samples = []
      return null
    }
    this.samples.push({ timeMs, hz })
    while (this.samples[0].timeMs <= timeMs - this.windowMs) this.samples.shift()
    return median(this.samples.map((s) => s.hz))
  }
}
```

`src/practice/engine.ts`:

```ts
import type { TimedFrame } from '../analysis/frame-analyzer'
import { NOISE_CHECK_MS, isTooNoisy, noiseFloorDb } from '../analysis/level'
import { DEFAULT_TRACKER_CONFIG, NoteTracker, isVoiced, type TrackerConfig } from '../analysis/note-tracker'
import { PitchSmoother } from '../analysis/pitch-smoother'
import { centsBetween, hzToMidiFloat, midiToHz, noteName, type Judgement } from '../music/pitch'
import { scoreRun, type RunResult } from './scoring'
import { onNote, onTick, startSession, type SessionConfig, type WaitSessionState } from './wait-session'

export type EnginePhase = 'measuringNoise' | 'tooNoisy' | 'practicing' | 'finished'

export interface NeedleReading {
  /** Deviation of the current sound from the current target. */
  cents: number
  /** Name of the note being played when it is more than 50 cents away from the target. */
  playedName: string | null
}

export interface Rejection {
  index: number
  kind: Judgement['kind']
  playedName: string
}

export interface EngineSnapshot {
  phase: EnginePhase
  /** Fraction of the microphone check done, 0..1. */
  noiseCheckProgress: number
  noiseFloorDb: number | null
  session: WaitSessionState
  needle: NeedleReading | null
  lastRejection: Rejection | null
  result: RunResult | null
}

/** Everything between analyzed microphone frames and what the practice screen shows. No audio, no DOM. */
export class PracticeEngine {
  private readonly sessionConfig: SessionConfig
  private readonly smoother = new PitchSmoother(100)
  private readonly levels: number[] = []
  private firstFrameMs: number | null = null
  private tracker: NoteTracker | null = null
  private trackerConfig: TrackerConfig | null = null
  private current: EngineSnapshot

  constructor(session: WaitSessionState) {
    this.sessionConfig = session.config
    this.current = {
      phase: 'measuringNoise',
      noiseCheckProgress: 0,
      noiseFloorDb: null,
      session,
      needle: null,
      lastRejection: null,
      result: null,
    }
  }

  snapshot(): EngineSnapshot {
    return this.current
  }

  handleFrame(frame: TimedFrame): void {
    const phase = this.current.phase
    if (phase === 'measuringNoise') this.measureNoise(frame)
    else if (phase === 'practicing') this.practice(frame)
  }

  private measureNoise(frame: TimedFrame): void {
    this.firstFrameMs ??= frame.timeMs
    this.levels.push(frame.rmsDb)
    const elapsed = frame.timeMs - this.firstFrameMs
    if (elapsed < NOISE_CHECK_MS) {
      this.current = { ...this.current, noiseCheckProgress: elapsed / NOISE_CHECK_MS }
      return
    }
    const floor = noiseFloorDb(this.levels)
    if (isTooNoisy(floor)) {
      this.current = { ...this.current, phase: 'tooNoisy', noiseCheckProgress: 1, noiseFloorDb: floor }
      return
    }
    this.trackerConfig = { ...DEFAULT_TRACKER_CONFIG, noiseFloorDb: floor }
    this.tracker = new NoteTracker(this.trackerConfig)
    const session = startSession(this.current.session.exercise, this.sessionConfig, frame.timeMs)
    this.current = { ...this.current, phase: 'practicing', noiseCheckProgress: 1, noiseFloorDb: floor, session }
  }

  private practice(frame: TimedFrame): void {
    const tracker = this.tracker as NoteTracker
    const trackerConfig = this.trackerConfig as TrackerConfig
    let { session, lastRejection } = this.current

    const note = tracker.push(frame, frame.timeMs)
    if (note) {
      const step = onNote(session, note)
      session = step.state
      for (const e of step.events) {
        if (e.type === 'rejected') {
          lastRejection = {
            index: e.index,
            kind: e.judgement.kind,
            playedName: noteName(e.judgement.playedMidi, session.exercise.preferFlats),
          }
        } else if (e.type === 'accepted') {
          lastRejection = null
        }
      }
    }
    session = onTick(session, frame.timeMs).state

    const smoothed = this.smoother.push(isVoiced(frame, trackerConfig) ? frame.hz : null, frame.timeMs)
    const needle = session.finished ? null : this.needleFor(session, smoothed)

    if (session.finished) {
      this.current = {
        ...this.current,
        phase: 'finished',
        session,
        needle: null,
        lastRejection,
        result: scoreRun(session.targets, true),
      }
      return
    }
    this.current = { ...this.current, session, needle, lastRejection }
  }

  private needleFor(session: WaitSessionState, hz: number | null): NeedleReading | null {
    if (hz === null) return null
    const target = session.exercise.targets[session.cursor]
    const cents = centsBetween(hz, midiToHz(target.midi, this.sessionConfig.a4Hz))
    const playedName =
      Math.abs(cents) > 50
        ? noteName(Math.round(hzToMidiFloat(hz, this.sessionConfig.a4Hz)), session.exercise.preferFlats)
        : null
    return { cents, playedName }
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analysis src/practice
git commit -m "feat: practice engine with room check, tuning needle and synthetic performance tests"
```

---

### Task 9: Microphone, built-in exercises and practice UI

**Files:**
- Create: `src/audio/worklet-globals.d.ts`, `src/audio/frame.worklet.ts`, `src/audio/microphone.ts`, `src/exercises/samples.ts`, `src/ui/ScoreView.tsx`, `src/ui/TuningNeedle.tsx`, `src/ui/usePractice.ts`, `src/ui/PracticeScreen.tsx`, `src/ui/ExercisePicker.tsx`
- Modify: `src/App.tsx`, `src/index.css` (replace the placeholders)
- Test: `src/exercises/samples.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `class MicrophoneError extends Error { kind: 'denied' | 'notFound' | 'unsupported' | 'other' }`
  - `interface Microphone { sampleRate; stop(): Promise<void> }`
  - `startMicrophone(onFrame: (frame, timeMs, sampleRate) => void): Promise<Microphone>`
  - `SAMPLE_EXERCISES: { id: string; abc: string }[]`
  - React components `ScoreView`, `TuningNeedle`, `PracticeScreen`, `ExercisePicker`, and the hook `usePractice(exercise, config)`

Notes:
- `import workletUrl from './frame.worklet.ts?worker&url'` makes Vite bundle the worklet together with its imports (filter and frame collector) into one file. This was checked in a production build.
- The worklet node feeds a muted gain node connected to the destination, because some browsers only run nodes that lead to the output.
- Pitch analysis runs on the main thread: about 94 frames per second, each a 2048-point autocorrelation. The worklet only filters and frames.
- abcjs draws notes with `currentColor`, so CSS `color` on a note's elements colors it. `abselem.elemset` holds a note's SVG elements.
- The audio clock (sample count) drives both note times and the hint timer, so they never drift apart.

This task's deliverable is checked by the unit test below plus the end-to-end tests in Task 10.

- [ ] **Step 1: Write the failing test**

`src/exercises/samples.test.ts`:

```ts
import { expect, test } from 'vitest'
import { parseExercise } from '../score/abc'
import { SAMPLE_EXERCISES } from './samples'

test.each(SAMPLE_EXERCISES)('$id parses without errors or warnings, all in first position', ({ abc }) => {
  const result = parseExercise(abc)
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.warnings).toEqual([])
    expect(result.exercise.targets.every((t) => t.fingering !== null)).toBe(true)
  }
})

test('ids are unique', () => {
  const ids = SAMPLE_EXERCISES.map((s) => s.id)
  expect(new Set(ids).size).toBe(ids.length)
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/exercises`
Expected: FAIL, `Failed to resolve import "./samples"`.

- [ ] **Step 3: Write the built-in exercises**

`src/exercises/samples.ts`:

```ts
// Built-in exercises, written for this project. Exercises copied from method books
// (Suzuki, I Can Read Music, ...) are copyrighted: never add them to this file.

export interface SampleExercise {
  id: string
  abc: string
}

export const SAMPLE_EXERCISES: SampleExercise[] = [
  {
    id: 'open-strings',
    abc: `X:1
T:Open strings
M:4/4
L:1/4
K:D
G,2 D2 | A2 e2 | e2 A2 | D2 G,2 |]`,
  },
  {
    id: 'a-string-fingers',
    abc: `X:1
T:A string: fingers 0 to 3
M:4/4
L:1/4
K:D
A B c d | d c B A | A B c d | A4 |]`,
  },
  {
    id: 'd-major-scale',
    abc: `X:1
T:D major scale, one octave
M:4/4
L:1/4
K:D
D E F G | A B c d | d c B A | G F E D |]`,
  },
  {
    id: 'repeated-notes',
    abc: `X:1
T:Repeated notes (lift or change the bow between notes)
M:4/4
L:1/4
K:D
A A B B | c c d2 | d d c c | B B A2 |]`,
  },
  {
    id: 'twinkle',
    abc: `X:1
T:Twinkle, Twinkle, Little Star (traditional)
M:4/4
L:1/4
K:A
A A e e | f f e2 | d d c c | B B A2 |]`,
  },
]
```

Run: `npx vitest run src/exercises`
Expected: PASS.

- [ ] **Step 4: Write the audio input**

`src/audio/worklet-globals.d.ts`:

```ts
// Globals of the AudioWorkletGlobalScope, used only by frame.worklet.ts.
// The DOM library does not declare them.

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

declare const sampleRate: number
```

`src/audio/frame.worklet.ts`:

```ts
// Runs on the audio thread: filters the microphone signal and posts overlapping frames.
import { FRAME_SIZE, FrameCollector, HOP_SIZE } from '../analysis/frame-collector'
import { HIGH_PASS_HZ, HighPassFilter } from '../analysis/highpass'

export interface FrameMessage {
  frame: Float32Array
  endSample: number
}

class FrameCollectorProcessor extends AudioWorkletProcessor {
  private readonly filter = new HighPassFilter(HIGH_PASS_HZ, sampleRate)
  private readonly collector = new FrameCollector(FRAME_SIZE, HOP_SIZE, (frame, endSample) => {
    const message: FrameMessage = { frame, endSample }
    this.port.postMessage(message, [frame.buffer])
  })

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (channel) this.collector.push(this.filter.process(channel))
    return true
  }
}

registerProcessor('frame-collector', FrameCollectorProcessor)
```

`src/audio/microphone.ts`:

```ts
import workletUrl from './frame.worklet.ts?worker&url'
import type { FrameMessage } from './frame.worklet'

export type MicrophoneErrorKind = 'denied' | 'notFound' | 'unsupported' | 'other'

export class MicrophoneError extends Error {
  readonly kind: MicrophoneErrorKind

  constructor(kind: MicrophoneErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface Microphone {
  sampleRate: number
  stop(): Promise<void>
}

/** Frames arrive with their time on the audio clock (ms since the microphone started). */
export type FrameHandler = (frame: Float32Array, timeMs: number, sampleRate: number) => void

/**
 * Opens the microphone without the browser's voice processing (which would distort the violin
 * and flatten dynamics) and streams filtered frames. Call from a click handler.
 */
export async function startMicrophone(onFrame: FrameHandler): Promise<Microphone> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    throw new MicrophoneError('unsupported', 'This browser cannot record audio for analysis.')
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false },
    })
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicrophoneError('denied', 'Microphone access was blocked.')
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new MicrophoneError('notFound', 'No microphone was found.')
    }
    throw new MicrophoneError('other', String(e))
  }

  const context = new AudioContext()
  try {
    await context.audioWorklet.addModule(workletUrl)
    const source = context.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(context, 'frame-collector', { numberOfInputs: 1, numberOfOutputs: 1 })
    // Some browsers only run nodes that lead to the destination; a muted gain keeps it silent.
    const mute = context.createGain()
    mute.gain.value = 0
    node.port.onmessage = (event: MessageEvent<FrameMessage>) => {
      const { frame, endSample } = event.data
      onFrame(frame, (endSample / context.sampleRate) * 1000, context.sampleRate)
    }
    source.connect(node)
    node.connect(mute)
    mute.connect(context.destination)
    await context.resume()
    return {
      sampleRate: context.sampleRate,
      async stop() {
        node.port.onmessage = null
        stream.getTracks().forEach((t) => t.stop())
        await context.close()
      },
    }
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop())
    await context.close()
    throw new MicrophoneError('other', String(e))
  }
}
```

- [ ] **Step 5: Write the UI**

`src/ui/ScoreView.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import abcjs from 'abcjs'
import type { TuneObject } from 'abcjs'
import { fingeringLabel } from '../music/fingering'
import type { WaitSessionState } from '../practice/wait-session'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** abcjs sets `abselem` on rendered note items; its type definitions leave it out. */
interface RenderedItem {
  el_type: string
  startChar: number
  abselem?: { elemset: SVGElement[] }
}

/** Maps each note's ABC character offset to the SVG elements abcjs drew for it. */
function collectNoteElements(tune: TuneObject): Map<number, SVGElement[]> {
  const map = new Map<number, SVGElement[]>()
  for (const line of tune.lines) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices ?? []) {
        for (const item of voice as unknown as RenderedItem[]) {
          if (item.el_type === 'note' && item.abselem) map.set(item.startChar, item.abselem.elemset)
        }
      }
    }
  }
  return map
}

export function ScoreView({ session }: { session: WaitSessionState }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef(new Map<number, SVGElement[]>())
  const { exercise } = session

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const [tune] = abcjs.renderAbc(container, exercise.abc, { add_classes: true, responsive: 'resize' })
    elementsRef.current = tune ? collectNoteElements(tune) : new Map()
  }, [exercise.abc])

  useEffect(() => {
    containerRef.current?.querySelectorAll('.vt-hint').forEach((el) => el.remove())
    exercise.targets.forEach((target, i) => {
      const elements = elementsRef.current.get(target.sourceStart)
      if (!elements || elements.length === 0) return
      const state = session.targets[i]
      const current = i === session.cursor && !session.finished
      for (const el of elements) {
        el.classList.toggle('vt-current', current)
        el.classList.toggle('vt-green', state.color === 'green')
        el.classList.toggle('vt-yellow', state.color === 'yellow')
        el.classList.toggle('vt-missed', state.redAttempts > 0)
      }
      if (state.hintVisible && target.fingering && !session.finished) {
        const group = elements[0] as SVGGraphicsElement
        const box = group.getBBox()
        const text = document.createElementNS(SVG_NS, 'text')
        text.setAttribute('class', 'vt-hint')
        text.setAttribute('x', String(box.x + box.width / 2))
        text.setAttribute('y', String(box.y - 8))
        text.setAttribute('text-anchor', 'middle')
        text.textContent = fingeringLabel(target.fingering)
        group.parentNode?.appendChild(text)
      }
    })
  }, [session, exercise])

  return <div className="score" ref={containerRef} />
}
```

`src/ui/TuningNeedle.tsx`:

```tsx
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
```

`src/ui/usePractice.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { createFrameAnalyzer } from '../analysis/frame-analyzer'
import { FRAME_SIZE, HOP_SIZE } from '../analysis/frame-collector'
import { MicrophoneError, startMicrophone, type Microphone } from '../audio/microphone'
import { PracticeEngine, type EngineSnapshot } from '../practice/engine'
import { startSession, type SessionConfig } from '../practice/wait-session'
import type { Exercise } from '../score/exercise'

export type PracticeStatus = 'idle' | 'starting' | 'running' | 'error'

/** Connects the microphone to a PracticeEngine and publishes its snapshot once per screen refresh. */
export function usePractice(exercise: Exercise, config: SessionConfig) {
  const [status, setStatus] = useState<PracticeStatus>('idle')
  const [error, setError] = useState<MicrophoneError | null>(null)
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null)
  const micRef = useRef<Microphone | null>(null)
  const frameRequestRef = useRef<number | null>(null)

  const stop = useCallback(async () => {
    if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current)
    frameRequestRef.current = null
    const mic = micRef.current
    micRef.current = null
    await mic?.stop()
  }, [])

  const start = useCallback(async () => {
    await stop()
    const engine = new PracticeEngine(startSession(exercise, config, 0))
    setSnapshot(engine.snapshot())
    setError(null)
    setStatus('starting')
    try {
      const analyze = createFrameAnalyzer(FRAME_SIZE, HOP_SIZE)
      micRef.current = await startMicrophone((frame, timeMs, sampleRate) => {
        engine.handleFrame({ ...analyze(frame, sampleRate), timeMs })
      })
    } catch (e) {
      setError(e instanceof MicrophoneError ? e : new MicrophoneError('other', String(e)))
      setStatus('error')
      return
    }
    setStatus('running')
    const publish = () => {
      const s = engine.snapshot()
      setSnapshot(s)
      if (s.phase === 'finished' || s.phase === 'tooNoisy') {
        void stop()
        return
      }
      frameRequestRef.current = requestAnimationFrame(publish)
    }
    frameRequestRef.current = requestAnimationFrame(publish)
  }, [exercise, config, stop])

  useEffect(() => () => void stop(), [stop])

  return { status, error, snapshot, start }
}
```

`src/ui/PracticeScreen.tsx`:

```tsx
import { useMemo } from 'react'
import type { MicrophoneError } from '../audio/microphone'
import type { EngineSnapshot } from '../practice/engine'
import { startSession, type SessionConfig } from '../practice/wait-session'
import type { Exercise } from '../score/exercise'
import { ScoreView } from './ScoreView'
import { TuningNeedle } from './TuningNeedle'
import { usePractice } from './usePractice'

const MIC_ERROR_TEXT: Record<MicrophoneError['kind'], string> = {
  denied:
    'Microphone access is blocked. Click the microphone icon in the address bar, allow access, then press Start again.',
  notFound: 'No microphone was found. Connect one and press Start again.',
  unsupported: 'This browser cannot analyze microphone audio. Use a current version of Chrome or Firefox.',
  other: 'The microphone could not be started.',
}

export function PracticeScreen(props: { exercise: Exercise; config: SessionConfig; onExit: () => void }) {
  const { exercise, config, onExit } = props
  const { status, error, snapshot, start } = usePractice(exercise, config)
  const preview = useMemo(() => startSession(exercise, config, 0), [exercise, config])
  const active = status !== 'idle' && status !== 'error' && snapshot !== null

  return (
    <main className="practice">
      <header className="practice-header">
        <button type="button" onClick={onExit}>
          ← Exercises
        </button>
        <h1>{exercise.title}</h1>
      </header>

      <ScoreView session={active ? snapshot.session : preview} />

      {status === 'idle' && (
        <section className="panel">
          <p>When you press Start, stay quiet for two seconds while the app listens to the room.</p>
          <button type="button" className="primary" onClick={() => void start()}>
            Start
          </button>
        </section>
      )}

      {status === 'error' && error && (
        <section className="panel panel-error" role="alert">
          <p>{MIC_ERROR_TEXT[error.kind]}</p>
          <button type="button" className="primary" onClick={() => void start()}>
            Start
          </button>
        </section>
      )}

      {active && <PracticeStatus snapshot={snapshot} config={config} onRestart={() => void start()} />}
    </main>
  )
}

function PracticeStatus(props: { snapshot: EngineSnapshot; config: SessionConfig; onRestart: () => void }) {
  const { snapshot, config, onRestart } = props

  switch (snapshot.phase) {
    case 'measuringNoise':
      return (
        <section className="panel">
          <p>Stay quiet… checking the room.</p>
          <progress max={1} value={snapshot.noiseCheckProgress} />
        </section>
      )

    case 'tooNoisy':
      return (
        <section className="panel panel-error" role="alert">
          <p>
            The room is too noisy for reliable judging ({Math.round(snapshot.noiseFloorDb ?? 0)} dB). Close windows
            or move away from the noise, then try again.
          </p>
          <button type="button" className="primary" onClick={onRestart}>
            Try again
          </button>
        </section>
      )

    case 'practicing': {
      const rejection = snapshot.lastRejection
      return (
        <>
          <TuningNeedle reading={snapshot.needle} tolerances={config.tolerances} />
          <p className="feedback" aria-live="polite">
            {rejection?.kind === 'wrongNote' && `That was ${rejection.playedName}. Try again.`}
            {rejection?.kind === 'outOfTune' && 'Right note, but out of tune. Adjust and play it again.'}
          </p>
        </>
      )
    }

    case 'finished': {
      const result = snapshot.result
      if (!result) return null
      return (
        <section className="panel summary">
          <p className="stars" aria-label={`${result.stars} of 3 stars`}>
            {'★'.repeat(result.stars)}
            {'☆'.repeat(3 - result.stars)}
          </p>
          <p>
            {result.points} of {result.maxPoints} points. Yellow notes were a little out of tune; notes with a red
            ring needed more than one try.
          </p>
          <button type="button" className="primary" onClick={onRestart}>
            Play again
          </button>
        </section>
      )
    }
  }
}
```

`src/ui/ExercisePicker.tsx`:

```tsx
import { useState } from 'react'
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
```

Replace `src/App.tsx`:

```tsx
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
```

Replace `src/index.css`:

```css
:root {
  --bg: #fbfaf7;
  --surface: #ffffff;
  --text: #1d1b18;
  --muted: #6b665e;
  --border: #e3dfd6;
  --accent: #8a4b14;
  --green: #1f8a3b;
  --yellow: #b7860b;
  --red: #c62828;
  --current: #1565c0;
  --band-green: rgba(31, 138, 59, 0.25);
  --band-yellow: rgba(183, 134, 11, 0.2);
  color-scheme: light;
  font: 18px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171614;
    --surface: #211f1c;
    --text: #f1eee8;
    --muted: #a8a196;
    --border: #3a3631;
    --accent: #e0a060;
    --green: #4cc26a;
    --yellow: #e2b53a;
    --red: #ef5350;
    --current: #64b5f6;
    --band-green: rgba(76, 194, 106, 0.25);
    --band-yellow: rgba(226, 181, 58, 0.2);
    color-scheme: dark;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}

button {
  font: inherit;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}

textarea {
  width: 100%;
  font: 16px/1.4 ui-monospace, Menlo, monospace;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}

.exercise-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 8px;
}

.exercise-list button {
  width: 100%;
  text-align: left;
}

.errors,
.panel-error {
  color: var(--red);
}

.warning {
  color: var(--yellow);
}

.practice-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.practice-header h1 {
  font-size: 1.3rem;
  margin: 0;
}

.panel {
  margin: 24px 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.panel progress {
  width: 100%;
}

/* Score: abcjs draws with currentColor, so color changes the note. */
.score {
  margin: 16px 0;
  padding: 8px;
  background: #ffffff;
  border-radius: 12px;
  color: #1d1b18;
}

.score .vt-current {
  color: var(--current);
}

.score .vt-green {
  color: #1f8a3b;
}

.score .vt-yellow {
  color: #b7860b;
}

.score .vt-missed {
  outline: 2px solid #c62828;
  outline-offset: 2px;
  border-radius: 50%;
}

.score .vt-hint {
  font: bold 13px system-ui, sans-serif;
  fill: #1565c0;
}

.needle {
  margin: 16px 0;
}

.needle-scale {
  position: relative;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  overflow: hidden;
}

.needle-band {
  position: absolute;
  top: 0;
  bottom: 0;
}

.needle-band-yellow {
  background: var(--band-yellow);
}

.needle-band-green {
  background: var(--band-green);
}

.needle-center {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--muted);
}

.needle-pointer {
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: 6px;
  margin-left: -3px;
  border-radius: 3px;
  background: var(--text);
}

.needle-green .needle-pointer {
  background: var(--green);
}

.needle-yellow .needle-pointer {
  background: var(--yellow);
}

.needle-off .needle-pointer {
  background: var(--red);
}

.needle-labels {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 0.85rem;
}

.needle-value {
  color: var(--text);
  font-weight: 600;
}

.needle-off .needle-value {
  color: var(--red);
}

.feedback {
  min-height: 1.5em;
  color: var(--red);
}

.stars {
  font-size: 2.5rem;
  color: var(--yellow);
  margin: 0;
}
```

- [ ] **Step 6: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors; all unit tests pass; the build lists `dist/assets/frame.worklet-*.js` (about 1.3 kB) and `index-*.js`. Vite may warn that a chunk is larger than 500 kB (abcjs); that is expected.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: microphone worklet, built-in exercises and wait-mode practice screen"
```

---

### Task 10: End-to-end test through the fake microphone, and manual check

**Files:**
- Create: `src/test-support/wav.ts`, `e2e/generate-fixtures.ts`, `e2e/practice.spec.ts`, `playwright.config.ts`
- Modify: `package.json` (Playwright dev dependency; the `e2e` script already exists)

**Interfaces:**
- Consumes: `synth.ts` (Task 4), the whole app (Task 9).
- Produces: `encodeWav(samples, sampleRate): Uint8Array`; `npm run e2e`.

Chrome's `--use-file-for-fake-audio-capture` plays a WAV file as the microphone, in a loop. The fixture starts with 3 s of silence so the 2 s room check measures silence. Node 26 runs the `.ts` generator directly (type stripping), so no extra tool is needed.

- [ ] **Step 1: Install Playwright and its Chromium**

Run: `npm install -D @playwright/test@^1.64.1 && npx playwright install chromium`

- [ ] **Step 2: Write the WAV encoder and the fixture generator**

`src/test-support/wav.ts`:

```ts
/** Encodes mono samples (-1..1) as a 16-bit PCM WAV file. Test-only code. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(s * 32767), true)
  }
  return bytes
}
```

`e2e/generate-fixtures.ts`:

```ts
// Generates the fake-microphone WAV files used by the end-to-end tests.
// Run: node e2e/generate-fixtures.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { SAMPLE_RATE, VIOLIN_HARMONICS, WEAK_FUNDAMENTAL_HARMONICS, concat, silence, tone } from '../src/test-support/synth.ts'
import { encodeWav } from '../src/test-support/wav.ts'

const hz = (midi: number, cents = 0) => 440 * 2 ** ((midi - 69) / 12) * 2 ** (cents / 1200)
const note = (midi: number, cents = 0) =>
  concat(tone({ hz: hz(midi, cents), ms: 500, harmonics: midi < 62 ? WEAK_FUNDAMENTAL_HARMONICS : VIOLIN_HARMONICS }), silence(150))

// "Open strings": G, D A e | e A D G, with one wrong note (B4) before the second A and the last G 28 cents flat.
const openStrings = concat(
  silence(3000), // room check: the app listens for 2 s after Start
  note(55), note(62), note(69), note(76),
  note(76), note(71), note(69), note(62), note(55, -28),
  silence(5000),
)
mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true })
writeFileSync(new URL('./fixtures/open-strings.wav', import.meta.url), encodeWav(openStrings, SAMPLE_RATE))
console.log('wrote e2e/fixtures/open-strings.wav')
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./e2e/fixtures/open-strings.wav', import.meta.url))

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${fixture}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 3: Write the end-to-end tests**

`e2e/practice.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('open strings through the fake microphone: colors, red marker, yellow, stars', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Open strings' }).click()
  await expect(page.locator('.score svg')).toBeVisible()
  await expect(page.locator('.vt-hint').first()).toHaveText('G 0') // the preview already shows the first hint
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Stay quiet')).toBeVisible()
  await expect(page.getByText('Play the highlighted note')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.stars')).toBeVisible({ timeout: 30_000 })

  const notes = page.locator('.score .abcjs-note')
  await expect(notes).toHaveCount(8)
  const classes = await notes.evaluateAll((els) => els.map((e) => e.getAttribute('class') ?? ''))
  const color = (c: string) => (c.includes('vt-green') ? 'green' : c.includes('vt-yellow') ? 'yellow' : 'none')
  expect(classes.map(color)).toEqual(['green', 'green', 'green', 'green', 'green', 'green', 'green', 'yellow'])
  expect(classes.map((c) => c.includes('vt-missed'))).toEqual([false, false, false, false, false, true, false, false])
  // points: 6 greens * 2 + green-after-red 1 + yellow 1 = 14 of 16 = 87.5% -> 2 stars
  await expect(page.locator('.stars')).toHaveAttribute('aria-label', '2 of 3 stars')
  expect(errors).toEqual([])
})

test('leaving mid-exercise releases the microphone, and the next exercise can start', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Open strings' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Stay quiet')).toBeVisible()
  await page.getByRole('button', { name: '← Exercises' }).click()
  await page.getByRole('button', { name: 'D major scale, one octave' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Play the highlighted note')).toBeVisible({ timeout: 10_000 })
  expect(errors).toEqual([])
})
```

- [ ] **Step 4: Run them**

Run: `npm run e2e`
Expected: `wrote e2e/fixtures/open-strings.wav`, then `2 passed`.

If the first test fails on colors, open `test-results/` and look at the trace. Compare the classes on `.abcjs-note` elements with the expected list: 6 greens, a green with `vt-missed` at position 6, and a yellow last note.

- [ ] **Step 5: Run everything once more**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e/generate-fixtures.ts e2e/practice.spec.ts src/test-support/wav.ts
git commit -m "test: end-to-end practice run through Chrome's fake microphone"
```

- [ ] **Step 7: Manual check with a real violin (the human partner does this)**

Run: `npm run dev` and open the printed URL in **Chrome**, then in **Firefox**. In each browser:

1. Choose *Open strings*. Press Start and allow the microphone. Stay quiet until "Play the highlighted note" appears.
2. Play the open strings. Each in-tune note should turn green and move the cursor. The needle should move with your intonation.
3. Play a wrong note on purpose. It should say "That was …", the cursor should stay, and the hint should stay visible.
4. Choose *Repeated notes*. Each repeated note should advance only after a bow change or lift.
5. Press "← Exercises" in the middle of an exercise, start another one, and check that the microphone still works.
6. With a window open toward the road, start an exercise and note whether the room check passes.

Write down anything that felt wrong: notes that were never accepted, notes accepted too easily, needle jitter. Those observations, and recordings made in plan 3, are what the detection constants get tuned against.
