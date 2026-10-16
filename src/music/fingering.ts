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
