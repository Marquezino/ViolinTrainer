import { LETTER_NOTE_NAMES } from '../../music/pitch'
import type { Formatters, Messages } from './types'

const count = (n: number, one: string, other: string, f: Formatters) =>
  `${f.number(n)} ${f.plural(n) === 'one' ? one : other}`
const at = (offset: number, f: Formatters) => `at character ${f.number(offset)}`

export const en: Messages = {
  appName: 'Violin Trainer',
  noteNames: LETTER_NOTE_NAMES,
  languageLabel: 'Language',
  untitled: 'Untitled',

  picker: {
    exercisesHeading: 'Exercises',
    ownAbcHeading: 'Your own ABC',
    starterTitle: 'My exercise',
    abcLabel: 'ABC notation',
    previewLabel: 'Score preview',
    practiceThis: 'Practice this',
  },

  practice: {
    back: '← Exercises',
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
  },
}
