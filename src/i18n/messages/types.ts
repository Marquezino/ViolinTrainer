import type { MicrophoneError, VoiceProcessing } from '../../audio/microphone'
import type { BuiltinUnitId } from '../../exercises/builtin-units'
import type { SampleId } from '../../exercises/samples'
import type { NoteNames, ToleranceProblem } from '../../music/pitch'
import type { AbcProblem, AbcProblemCode } from '../../score/exercise'
import type { BackupProblem } from '../../store/backup'
import type { PersistenceStatus } from '../../store/persistence'
import type { Avatar, StreakKind } from '../../store/records'

/** Turns values into text for the current language. */
export interface Formatters {
  note(midi: number): string
  number(n: number): string
  /** Plural category of `n` under this language's rules. */
  plural(n: number): Intl.LDMLPluralRule
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
  /** Shown instead of the app when it could not start. */
  startupFailed: string

  /** The "Try your own ABC" screen (it was the Plan 1 exercise picker). */
  picker: {
    back: string
    ownAbcHeading: string
    /** Default T: title of the starter tune in the ABC box. */
    starterTitle: string
    abcLabel: string
    previewLabel: string
    practiceThis: string
  }

  practice: {
    back: string
    /** Header button that leaves a saved run for the path. */
    backToPath: string
    /** Summary button next to "Play again". */
    backToPathButton: string
    /** Shown during a run when today's goal is reached. */
    goalReached: string
    /** Summary line: today's practice time, run included, against the goal. */
    today: (activeMs: number, goalMinutes: number, f: Formatters) => string
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

  /** The tuning helper offered before practice (§7.4). Needle texts come from `needle`. */
  tuning: {
    heading: string
    intro: string
    /** Screen-reader label of the list of the four open strings. */
    stringsLabel: string
    listen: string
    /** Needle text while no string is heard. */
    prompt: string
    /** Goes to practice before listening. */
    skip: string
    /** Goes to practice after tuning. */
    ready: string
    /** Per-profile checkbox: skip the tuning screen from now on. */
    dontShowAgain: string
  }

  profiles: {
    heading: string
    addFirst: string
    settings: string
    avatars: Record<Avatar, string>
  }

  leaderboard: {
    heading: string
    /** Button on the picker and the path. */
    open: string
    back: string
    empty: string
    /** Shown above the rows: this ranks effort, not skill. */
    subtitle: string
    placeLabel: (place: number, f: Formatters) => string
    goalDays: (days: number, f: Formatters) => string
    runs: (runs: number, f: Formatters) => string
  }

  path: {
    back: string
    /** Visible next to the goal ring. */
    todayTime: (activeMs: number, goalMinutes: number, f: Formatters) => string
    /** Screen-reader label of the goal ring. */
    goalRingLabel: (activeMs: number, goalMinutes: number, f: Formatters) => string
    /** `days` is the number of goal days this week, Monday to Sunday. */
    weekLabel: (days: number, f: Formatters) => string
    locked: string
    next: string
    empty: string
    /** Shown when a stored exercise no longer parses. */
    brokenExercise: string
  }

  streaks: {
    /** Short names, used in repair offers and celebrations. */
    names: Record<StreakKind, string>
    /** Screen-reader labels of the streak badges. */
    label: (streak: StreakKind, days: number, f: Formatters) => string
  }

  notes: {
    balanceLabel: (notes: number, f: Formatters) => string
    broke: (streak: StreakKind) => string
    /** `icon` is the streak's symbol; `restores` the streak length the repair gives back. */
    repairOffer: (restores: number, icon: string, cost: number, f: Formatters) => string
    missing: (notes: number, f: Formatters) => string
    confirm: (cost: number, f: Formatters) => string
    confirmYes: string
    cancel: string
    errors: Record<'noOffer' | 'notAffordable' | 'other', string>
  }

  celebrations: {
    goalReached: string
    streakMilestone: (streak: StreakKind, days: number, f: Formatters) => string
    newBestStars: (stars: number, f: Formatters) => string
    dismiss: string
  }

  settings: {
    heading: string
    back: string
    playersHeading: string
    newPlayerName: string
    avatar: string
    addPlayer: string
    nameRequired: string
    name: string
    goal: string
    greenCents: string
    yellowCents: string
    skipTuning: string
    save: string
    saved: string
    deletePlayer: string
    deleteConfirm: (name: string) => string
    deleteYes: string
    cancel: string
    a4Heading: string
    a4Label: string
    a4Problem: (min: number, max: number, f: Formatters) => string
    otherHeading: string
    tryAbc: string
  }

  /** The round "?" help tips in settings: one or two short sentences each. */
  help: {
    /** Accessible name of a help button; `field` is the label it explains. */
    label: (field: string) => string
    newPlayer: string
    goal: string
    greenCents: string
    yellowCents: string
    /** Visible question next to the tolerances, with the cents help. */
    centsQuestion: string
    cents: string
    skipTuning: string
    a4: string
    backup: string
  }

  backup: {
    heading: string
    export: string
    import: string
    reminderLabel: string
    lastBackupNever: string
    lastBackupDaysAgo: (days: number, f: Formatters) => string
    reminderDismiss: string
    problems: Record<BackupProblem, string>
    confirm: (profiles: number, attempts: number, f: Formatters) => string
    replace: string
    cancel: string
    restored: string
    failed: string
    /** Shown when an export could not be saved. */
    exportFailed: string
  }

  storage: {
    notSaved: string
    persistence: Record<PersistenceStatus, string>
  }

  microphoneErrors: Record<MicrophoneError['kind'], string>
  voiceProcessing: Record<VoiceProcessing, string>
  abcProblems: { [K in AbcProblemCode]: (p: Extract<AbcProblem, { code: K }>, f: Formatters) => string }
  toleranceProblems: Record<ToleranceProblem, string>
  sampleTitles: Record<SampleId, string>
  unitTitles: Record<BuiltinUnitId, string>
}
