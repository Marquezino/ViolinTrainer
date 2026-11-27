import { centsBetween, midiToHz } from '../music/pitch'

/** The four open strings, low to high: G3, D4, A4, E5. */
export const OPEN_STRING_MIDI = [55, 62, 69, 76] as const

/** The tuning needle is green within this many cents of the string (spec §7.4). */
export const TUNING_GREEN_CENTS = 5

/** The open string closest to `hz` (in cents), and how far from it `hz` is. Positive is sharp. */
export function nearestOpenString(hz: number, a4Hz: number): { midi: number; cents: number } {
  let best: { midi: number; cents: number } | null = null
  for (const midi of OPEN_STRING_MIDI) {
    const cents = centsBetween(hz, midiToHz(midi, a4Hz))
    if (best === null || Math.abs(cents) < Math.abs(best.cents)) best = { midi, cents }
  }
  return best!
}
