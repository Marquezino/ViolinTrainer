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

export type ToleranceProblem = 'greenNotPositive' | 'yellowBelowGreen' | 'yellowTooWide'

export function validateTolerances(t: Tolerances): ToleranceProblem | null {
  if (!(t.greenCents > 0)) return 'greenNotPositive'
  if (t.yellowCents < t.greenCents) return 'yellowBelowGreen'
  if (t.yellowCents >= 50) return 'yellowTooWide'
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

/** The seven note names, starting from C. */
export type NoteNames = readonly [c: string, d: string, e: string, f: string, g: string, a: string, b: string]

export const LETTER_NOTE_NAMES: NoteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
export const SOLFEGE_NOTE_NAMES: NoteNames = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si']

type Accidental = '' | '♯' | '♭'

/** Pitch class -> index of the letter (C = 0 ... B = 6) and its accidental. */
const SHARP_SPELLING: [number, Accidental][] = [
  [0, ''], [0, '♯'], [1, ''], [1, '♯'], [2, ''], [3, ''],
  [3, '♯'], [4, ''], [4, '♯'], [5, ''], [5, '♯'], [6, ''],
]
const FLAT_SPELLING: [number, Accidental][] = [
  [0, ''], [1, '♭'], [1, ''], [2, '♭'], [2, ''], [3, ''],
  [4, '♭'], [4, ''], [5, '♭'], [5, ''], [6, '♭'], [6, ''],
]

export function noteName(midi: number, preferFlats: boolean, names: NoteNames = LETTER_NOTE_NAMES): string {
  const pitchClass = ((midi % 12) + 12) % 12
  const [letter, accidental] = (preferFlats ? FLAT_SPELLING : SHARP_SPELLING)[pitchClass]
  const octave = Math.floor(midi / 12) - 1
  return `${names[letter]}${accidental}${octave}`
}
