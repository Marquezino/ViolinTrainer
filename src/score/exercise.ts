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
