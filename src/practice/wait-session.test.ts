import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
import { defaultFingering } from '../music/fingering'
import { DEFAULT_TOLERANCES, midiToHz } from '../music/pitch'
import type { Exercise } from '../score/exercise'
import { DEFAULT_HINT_DELAY_MS, onNote, onTick, startSession, type SessionConfig } from './wait-session'

function exerciseOf(midis: number[]): Exercise {
  return {
    title: 'test',
    abc: '',
    preferFlats: false,
    targets: midis.map((midi, index) => ({
      index,
      midi,
      durationWhole: 0.25,
      fingering: defaultFingering(midi),
      sourceStart: index,
    })),
  }
}

const config: SessionConfig = {
  tolerances: DEFAULT_TOLERANCES,
  a4Hz: 440,
  hintDelayMs: DEFAULT_HINT_DELAY_MS,
  initialHint: () => false,
}

const G4 = 67
const A4 = 69
const detune = (midi: number, cents: number) => midiToHz(midi) * 2 ** (cents / 1200)

describe('wait session', () => {
  test('the cursor advances only on the correct note', () => {
    let s = startSession(exerciseOf([G4, A4]), config, 0)
    let step = onNote(s, { hz: midiToHz(70), timeMs: 100 }) // A#4: wrong
    expect(step.state.cursor).toBe(0)
    expect(step.events[0]).toMatchObject({ type: 'rejected', index: 0, judgement: { kind: 'wrongNote', playedMidi: 70 } })
    s = step.state
    step = onNote(s, { hz: midiToHz(G4), timeMs: 200 })
    expect(step.state.cursor).toBe(1)
    expect(step.events[0]).toMatchObject({ type: 'accepted', index: 0, color: 'green' })
  })

  test('yellow advances and is recorded as yellow', () => {
    const step = onNote(startSession(exerciseOf([A4]), config, 0), { hz: detune(A4, 28), timeMs: 10 })
    expect(step.state.targets[0].color).toBe('yellow')
    expect(step.state.targets[0].centsAtAcceptance).toBeCloseTo(28, 6)
  })

  test('out of tune does not advance', () => {
    const step = onNote(startSession(exerciseOf([A4]), config, 0), { hz: detune(A4, -40), timeMs: 10 })
    expect(step.state.cursor).toBe(0)
    expect(step.events[0]).toMatchObject({ type: 'rejected', judgement: { kind: 'outOfTune' } })
  })

  test('red attempts are counted and reveal the hint', () => {
    let s = startSession(exerciseOf([A4]), config, 0)
    expect(s.targets[0].hintVisible).toBe(false)
    const step = onNote(s, { hz: midiToHz(71), timeMs: 10 })
    expect(step.events.map((e) => e.type)).toEqual(['rejected', 'hintShown'])
    s = step.state
    expect(s.targets[0]).toMatchObject({ redAttempts: 1, hintVisible: true })
    s = onNote(s, { hz: midiToHz(72), timeMs: 20 }).state
    expect(s.targets[0].redAttempts).toBe(2)
  })

  test('finishes after the last target', () => {
    let s = startSession(exerciseOf([G4, A4]), config, 0)
    s = onNote(s, { hz: midiToHz(G4), timeMs: 10 }).state
    const step = onNote(s, { hz: midiToHz(A4), timeMs: 20 })
    expect(step.state.finished).toBe(true)
    expect(step.events.map((e) => e.type)).toEqual(['accepted', 'finished'])
    expect(onNote(step.state, { hz: midiToHz(A4), timeMs: 30 }).events).toEqual([])
  })

  test('the hint appears after the delay without a correct note', () => {
    const s = startSession(exerciseOf([A4]), config, 1000)
    expect(onTick(s, 1000 + DEFAULT_HINT_DELAY_MS - 1).events).toEqual([])
    const step = onTick(s, 1000 + DEFAULT_HINT_DELAY_MS)
    expect(step.events).toEqual([{ type: 'hintShown', index: 0 }])
    expect(onTick(step.state, 99999).events).toEqual([])
  })

  test('the hint delay restarts when the cursor moves', () => {
    let s = startSession(exerciseOf([G4, A4]), config, 0)
    s = onNote(s, { hz: midiToHz(G4), timeMs: 4000 }).state
    expect(onTick(s, 6000).events).toEqual([])
    expect(onTick(s, 9000).events).toEqual([{ type: 'hintShown', index: 1 }])
  })

  test('notes without a fingering never show a hint', () => {
    let s = startSession(exerciseOf([90]), { ...config, initialHint: () => true }, 0)
    expect(s.targets[0].hintVisible).toBe(false)
    expect(onTick(s, 99999).events).toEqual([])
    s = onNote(s, { hz: midiToHz(89), timeMs: 10 }).state
    expect(s.targets[0].hintVisible).toBe(false)
  })

  test('initialHint decides the starting hints', () => {
    const s = startSession(exerciseOf([G4, A4]), { ...config, initialHint: (t) => t.midi === A4 }, 0)
    expect(s.targets.map((t) => t.hintVisible)).toEqual([false, true])
  })

  test('uses the configured A4 reference', () => {
    const at442 = { ...config, a4Hz: 442 }
    const step = onNote(startSession(exerciseOf([A4]), at442, 0), { hz: 442, timeMs: 10 })
    expect(step.state.targets[0].color).toBe('green')
  })

  test('PROPERTY: the cursor never passes a target without a green or yellow acceptance', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 55, max: 83 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.tuple(fc.integer({ min: 50, max: 90 }), fc.double({ min: -60, max: 60, noNaN: true }))),
        (midis, played) => {
          let s = startSession(exerciseOf(midis), config, 0)
          played.forEach(([midi, cents], i) => {
            const before = s.cursor
            s = onNote(s, { hz: detune(midi, cents), timeMs: i * 100 }).state
            if (s.cursor > before) {
              const t = s.targets[before]
              expect(t.color).not.toBeNull()
              expect(Math.abs(t.centsAtAcceptance!)).toBeLessThanOrEqual(DEFAULT_TOLERANCES.yellowCents)
              expect(midi + Math.round(cents / 100)).toBe(midis[before])
            }
          })
        },
      ),
    )
  })
})
