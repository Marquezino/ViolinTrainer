import type { MicrophoneError, VoiceProcessing } from '../../audio/microphone'
import type { SampleId } from '../../exercises/samples'
import type { NoteNames, ToleranceProblem } from '../../music/pitch'
import type { AbcProblem, AbcProblemCode } from '../../score/exercise'

/** Turns values into text for the current language. */
export interface Formatters {
  note(midi: number): string
  number(n: number): string
}

export type CentsDirection = 'flat' | 'sharp'

/** Every text the app shows, for one language. Texts with values are functions. */
export interface Messages {
  appName: string
  /** Note names in this language's notation; string names on the score come from them too. */
  noteNames: NoteNames
  /** Screen-reader label of the language menu. */
  languageLabel: string
  /** Title shown for an exercise without a T: line. */
  untitled: string

  picker: {
    exercisesHeading: string
    ownAbcHeading: string
    /** Default T: title of the starter tune in the ABC box. */
    starterTitle: string
    abcLabel: string
    previewLabel: string
    practiceThis: string
  }

  practice: {
    back: string
    startPrompt: string
    start: string
    tryAgain: string
    playAgain: string
    roomCheck: string
    heardPlaying: string
    /** `db` is already rounded. */
    tooNoisy: (db: number, f: Formatters) => string
    noisyRoomHint: string
    /** `processing` holds the already translated names of the processing left on. */
    audioProcessingHint: (processing: string[]) => string
    /** `note` is already formatted. */
    wrongNote: (note: string) => string
    outOfTune: string
    summary: (points: number, maxPoints: number, f: Formatters) => string
    starsLabel: (stars: number, maxStars: number, f: Formatters) => string
  }

  needle: {
    prompt: string
    /** `note` is already formatted. */
    playing: (note: string) => string
    /** `cents` is the size of the deviation, already rounded (never negative). */
    cents: (cents: number, direction: CentsDirection, f: Formatters) => string
    inTune: string
    flatLabel: string
    sharpLabel: string
  }

  microphoneErrors: Record<MicrophoneError['kind'], string>
  voiceProcessing: Record<VoiceProcessing, string>
  abcProblems: { [K in AbcProblemCode]: (p: Extract<AbcProblem, { code: K }>, f: Formatters) => string }
  toleranceProblems: Record<ToleranceProblem, string>
  sampleTitles: Record<SampleId, string>
}
