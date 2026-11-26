import { LETTER_NOTE_NAMES } from '../../music/pitch'
import { STREAK_SYMBOLS } from '../streak-symbols'
import type { Formatters, Messages } from './types'

const count = (n: number, one: string, other: string, f: Formatters) =>
  `${f.number(n)} ${f.plural(n) === 'one' ? one : other}`
const at = (offset: number, f: Formatters) => `at character ${f.number(offset)}`
/** Practice time as m:ss, rounded down: a few seconds already show. */
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const STREAK_NAMES = { easy: 'playing streak', practice: 'goal streak' } as const

export const en: Messages = {
  appName: 'Violin Trainer',
  noteNames: LETTER_NOTE_NAMES,
  languageLabel: 'Language',
  untitled: 'Untitled',
  startupFailed: 'Violin Trainer could not start. Please reload the page.',

  picker: {
    back: '← Settings',
    ownAbcHeading: 'Your own ABC',
    starterTitle: 'My exercise',
    abcLabel: 'ABC notation',
    previewLabel: 'Score preview',
    practiceThis: 'Practice this',
  },

  practice: {
    back: '← Back',
    backToPath: '← Path',
    backToPathButton: 'Back to path',
    goalReached: "Today's goal reached! 🎉 Keep going if you like.",
    today: (ms, goal, f) => `Today: ${clock(ms)} of ${f.number(goal)} min`,
    startPrompt: 'When you press Start, stay quiet for two seconds while the app listens to the room.',
    start: 'Start',
    tryAgain: 'Try again',
    playAgain: 'Play again',
    roomCheck: 'Stay quiet… checking the room.',
    heardPlaying: 'I heard playing during the room check. Stay quiet until the check is over, then start playing.',
    tooNoisy: (db, f) =>
      `The room is too noisy for reliable judging (${f.number(db)} dB). Close windows or move away from the noise, then try again.`,
    noisyRoomHint: 'The room is a little noisy: play with a full sound so every note is heard.',
    audioProcessingHint: (processing) =>
      `The browser kept its audio processing on (${processing.join(', ')}). Notes may be judged less reliably. Try another browser or microphone.`,
    wrongNote: (note) => `That was ${note}. Try again.`,
    outOfTune: 'Right note, but out of tune. Adjust and play it again.',
    summary: (points, maxPoints, f) =>
      `${f.number(points)} of ${count(maxPoints, 'point', 'points', f)}. Green notes were in tune, yellow notes a little out of tune, and red notes needed more than one try.`,
    starsLabel: (stars, maxStars, f) => `${f.number(stars)} of ${count(maxStars, 'star', 'stars', f)}`,
  },

  needle: {
    prompt: 'Play the highlighted note',
    playing: (note) => `You are playing ${note}`,
    cents: (cents, direction, f) => `${count(cents, 'cent', 'cents', f)} ${direction === 'sharp' ? 'sharp' : 'flat'}`,
    inTune: 'In tune',
    flatLabel: 'flat',
    sharpLabel: 'sharp',
  },

  tuning: {
    heading: 'Tune your violin',
    intro: 'Play each open string. Turn the peg or the fine tuner until the needle is green. The string you are playing lights up.',
    stringsLabel: 'Open strings',
    listen: 'Start listening',
    prompt: 'Play an open string',
    skip: 'Skip',
    ready: 'Ready',
    dontShowAgain: "Don't show before practice",
  },

  leaderboard: {
    heading: 'This week',
    open: '🏆 This week',
    back: '← Back',
    empty: 'Add a player in Settings to start the weekly board.',
    subtitle: 'Ranked by days the goal was reached, Monday to Sunday.',
    placeLabel: (place, f) => `Place ${f.number(place)}`,
    goalDays: (days, f) => `${count(days, 'goal day', 'goal days', f)}`,
    runs: (runs, f) => `${count(runs, 'finished run', 'finished runs', f)}`,
  },

  profiles: {
    heading: "Who's practising?",
    addFirst: 'Add the first player',
    settings: '⚙ Settings',
    avatars: {
      violin: 'violin',
      note: 'musical note',
      clef: 'score',
      star: 'star',
      sun: 'sun',
      moon: 'moon',
      bird: 'bird',
      cat: 'cat',
      dog: 'dog',
      flower: 'flower',
      tree: 'tree',
      heart: 'heart',
    },
  },

  path: {
    back: '← Players',
    todayTime: (ms, goal, f) => `${clock(ms)} of ${f.number(goal)} min`,
    goalRingLabel: (ms, goal, f) => `Today's practice: ${clock(ms)} of ${count(goal, 'minute', 'minutes', f)}`,
    weekLabel: (days, f) => `Goal reached on ${count(days, 'day', 'days', f)} this week`,
    locked: 'Locked',
    next: 'Next',
    empty: 'There are no exercises yet. Ask a grown-up to add some in the settings.',
    brokenExercise: 'This exercise cannot be played: its music has a writing error.',
  },

  streaks: {
    names: STREAK_NAMES,
    label: (streak, days, f) => `${streak === 'easy' ? 'Playing streak' : 'Goal streak'}: ${count(days, 'day', 'days', f)}`,
  },

  notes: {
    balanceLabel: (n, f) => `${count(n, 'note', 'notes', f)} for repairing streaks`,
    broke: (streak) => `Your ${STREAK_NAMES[streak]} broke yesterday.`,
    repairOffer: (restores, icon, cost, f) => `Repair to ${f.number(restores)} ${icon} for ${f.number(cost)} ♪`,
    missing: (n, f) => `You need ${count(n, 'more note', 'more notes', f)}.`,
    confirm: (cost, f) => `Spend ${f.number(cost)} ♪ to repair yesterday? This can't be undone.`,
    confirmYes: 'Yes, repair',
    cancel: 'Cancel',
    errors: {
      noOffer: 'This repair is no longer available.',
      notAffordable: 'There are not enough notes for this repair.',
      other: 'The repair could not be saved. Try again.',
    },
  },

  celebrations: {
    goalReached: "You reached today's goal! 🎉",
    streakMilestone: (streak, days, f) => `${f.number(days)}-day ${STREAK_NAMES[streak]}! ${STREAK_SYMBOLS[streak]}`,
    newBestStars: (stars, f) => `New best: ${count(stars, 'star', 'stars', f)}!`,
    dismiss: 'Close',
  },

  settings: {
    heading: 'Settings',
    back: '← Players',
    playersHeading: 'Players',
    newPlayerName: 'New player name',
    avatar: 'Picture',
    addPlayer: 'Add player',
    nameRequired: 'Type a name first.',
    name: 'Name',
    goal: 'Daily goal (minutes)',
    greenCents: 'Green (cents)',
    yellowCents: 'Yellow (cents)',
    skipTuning: 'Skip the tuning screen',
    save: 'Save',
    saved: 'Saved.',
    deletePlayer: 'Delete player',
    deleteConfirm: (name) => `Delete ${name}? They disappear from the list; their runs stay in the data and in backups.`,
    deleteYes: 'Yes, delete',
    cancel: 'Cancel',
    a4Heading: 'Tuning reference',
    a4Label: 'A4 (Hz)',
    a4Problem: (min, max, f) => `A4 must be between ${f.number(min)} and ${f.number(max)} Hz.`,
    otherHeading: 'Other',
    tryAbc: 'Try your own ABC',
  },

  backup: {
    heading: 'Backup',
    export: 'Export backup',
    import: 'Import backup',
    reminderLabel: 'Backup reminder',
    lastBackupNever: 'Last backup: never',
    lastBackupDaysAgo: (days, f) => `Last backup: ${count(days, 'day', 'days', f)} ago`,
    reminderDismiss: 'Not now',
    problems: {
      notJson: 'This file cannot be read: it is not a backup, or it is damaged.',
      notABackup: 'This file is not a Violin Trainer backup.',
      newerVersion: 'This backup comes from a newer version of the app. Update the app, then import it.',
    },
    confirm: (profiles, attempts, f) =>
      `This backup has ${count(profiles, 'player', 'players', f)} and ${count(attempts, 'run', 'runs', f)}. Importing it replaces all the data in this browser; a copy of the current data is downloaded first.`,
    replace: 'Replace my data',
    cancel: 'Cancel',
    restored: 'Backup restored.',
    failed: 'The backup could not be restored. Your data was not changed.',
    exportFailed: 'The backup could not be saved. Try again.',
  },

  storage: {
    notSaved: "This window can't save progress (private browsing?). Practice works, but nothing is kept after it closes.",
    persistence: {
      granted: 'This browser keeps the data.',
      denied: 'This browser may clear the data: install the app or export backups often.',
      unsupported: 'This browser may clear the data: export backups often.',
    },
  },

  microphoneErrors: {
    denied:
      'Microphone access is blocked. Click the microphone icon in the address bar, allow access, then press Start again.',
    notFound: 'No microphone was found. Connect one and press Start again.',
    unsupported: 'This browser cannot analyze microphone audio. Use a current version of Chrome or Firefox.',
    other: 'The microphone could not be started.',
  },

  voiceProcessing: {
    autoGainControl: 'automatic volume',
    noiseSuppression: 'noise suppression',
    echoCancellation: 'echo cancellation',
  },

  abcProblems: {
    noTune: () => 'No tune found. An exercise needs an X: line and a K: line.',
    multipleTunes: () => 'Write only one tune per exercise.',
    abcSyntax: (p, f) => {
      if (p.line === null) return `The ABC has a writing error: ${p.detail}`
      const column = p.column === null ? '' : `, column ${f.number(p.column)}`
      return `The ABC has a writing error at line ${f.number(p.line)}${column}: ${p.detail}`
    },
    multipleVoices: () => 'Only a single melody line is supported (one staff, one voice).',
    repeats: (p, f) =>
      `Repeat signs and endings are not supported yet; write the music out in full (${at(p.at, f)}).`,
    chord: (p, f) => `Chords and double stops are not supported yet (${at(p.at, f)}).`,
    graceNotes: (p, f) => `Grace notes are not supported yet (${at(p.at, f)}).`,
    tieDifferentPitch: (p, f) => `A tie must join two notes of the same pitch; use ( ) for a slur (${at(p.at, f)}).`,
    unknownPitch: (p, f) => `Could not determine the pitch of the note ${at(p.at, f)}.`,
    belowViolin: (p, f) => `${f.note(p.midi)} is below the violin's lowest note (${f.note(p.lowestMidi)}) (${at(p.at, f)}).`,
    tooHigh: (p, f) =>
      `${f.note(p.midi)} is too high to be recognised; the highest supported note is ${f.note(p.highestMidi)} (${at(p.at, f)}).`,
    fingerFive: (p, f) => `Finger 5 does not exist on the violin (${at(p.at, f)}).`,
    fingerImpossible: (p, f) =>
      `${f.note(p.midi)} cannot be played with finger ${p.finger} in first position (${at(p.at, f)}).`,
    outsideFirstPosition: (p, f) =>
      `${f.note(p.midi)} is outside first position; no hint is shown for it (${at(p.at, f)}).`,
    noNotes: () => 'The exercise has no notes.',
  },

  toleranceProblems: {
    greenNotPositive: 'The green tolerance must be greater than 0 cents.',
    yellowBelowGreen: 'The yellow tolerance must not be smaller than the green tolerance.',
    yellowTooWide: 'The yellow tolerance must be below 50 cents (half a semitone).',
  },

  sampleTitles: {
    'open-strings': 'Open strings',
    'a-string-fingers': 'A string: fingers 0 to 3',
    'd-major-scale': 'D major scale, one octave',
    'repeated-notes': 'Repeated notes (lift or change the bow between notes)',
    twinkle: 'Twinkle, Twinkle, Little Star (traditional)',
    'lightly-row': 'Lightly Row (traditional)',
    'song-of-the-wind': 'Song of the Wind (traditional)',
    'go-tell-aunt-rhody': 'Go Tell Aunt Rhody (traditional)',
    'o-come-little-children': 'O Come, Little Children (traditional)',
    'may-song': 'May Song (traditional)',
    'long-long-ago': 'Long, Long Ago (traditional)',
  },
  unitTitles: {
    'first-steps': 'First steps',
    'traditional-tunes': 'Traditional tunes',
  },
}
