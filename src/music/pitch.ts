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
