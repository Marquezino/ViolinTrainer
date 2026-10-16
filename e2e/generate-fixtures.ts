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
