import { describe, expect, test } from 'vitest'
import { parseExercise } from './abc'
import type { Exercise, ParseResult } from './exercise'

const header = 'X:1\nT:Test\nM:4/4\nL:1/4\nK:D\n'

function ok(result: ParseResult): Exercise {
  if (!result.ok) throw new Error(`expected success, got: ${result.errors.join('; ')}`)
  return result.exercise
}

describe('parseExercise', () => {
  test('reads pitches with the key signature applied', () => {
    const ex = ok(parseExercise(header + 'G, D A e | f c |]'))
    expect(ex.title).toBe('Test')
    expect(ex.targets.map((t) => t.midi)).toEqual([55, 62, 69, 76, 78, 73]) // f and c are sharp in D major
    expect(ex.targets.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5])
  })

  test('accidentals carry through the bar and reset at the bar line', () => {
    const ex = ok(parseExercise('X:1\nL:1/4\nK:C\n^F F G F | F |]'))
    expect(ex.targets.map((t) => t.midi)).toEqual([66, 66, 67, 66, 65])
  })

  test('assigns default fingerings', () => {
    const ex = ok(parseExercise(header + 'A B c d |]'))
    expect(ex.targets.map((t) => t.fingering)).toEqual([
      { string: 'A', finger: 0, mark: null },
      { string: 'A', finger: 1, mark: null },
      { string: 'A', finger: 2, mark: 'high' },
      { string: 'A', finger: 3, mark: null },
    ])
  })

  test('a finger decoration overrides the default', () => {
    const ex = ok(parseExercise(header + '!4!A !0!A |]'))
    expect(ex.targets[0].fingering).toEqual({ string: 'D', finger: 4, mark: null })
    expect(ex.targets[1].fingering).toEqual({ string: 'A', finger: 0, mark: null })
  })

  test('an impossible finger is an error', () => {
    const result = parseExercise(header + '!3!B |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/B4 cannot be played with finger 3/)
  })

  test('skips rests and merges tied notes', () => {
    const ex = ok(parseExercise(header + 'z A2- | A2 B2 |]'))
    expect(ex.targets.map((t) => t.midi)).toEqual([69, 71])
    expect(ex.targets[0].durationWhole).toBe(1) // half tied to half
    expect(ex.targets[1].durationWhole).toBe(0.5)
  })

  test('keeps the source position of each note', () => {
    const abc = header + 'A B |]'
    const ex = ok(parseExercise(abc))
    expect(abc.slice(ex.targets[0].sourceStart, ex.targets[0].sourceStart + 1)).toBe('A')
    expect(abc.slice(ex.targets[1].sourceStart, ex.targets[1].sourceStart + 1)).toBe('B')
  })

  test('notes outside first position have no fingering and produce a warning', () => {
    const result = parseExercise(header + "A c' |]")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.exercise.targets[1].fingering).toBeNull()
      expect(result.warnings[0]).toMatch(/C♯6 is outside first position/)
    }
  })

  test('prefers flats in flat keys', () => {
    expect(ok(parseExercise('X:1\nL:1/4\nK:F\nB |]')).preferFlats).toBe(true)
    expect(ok(parseExercise(header + 'B |]')).preferFlats).toBe(false)
  })

  test('rejects chords', () => {
    const result = parseExercise(header + '[GB] A |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/Chords and double stops/)
  })

  test('rejects syntax errors with readable messages', () => {
    const result = parseExercise(header + 'A ) B |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).not.toMatch(/<span/)
  })

  test.each([
    ['repeat signs', '|: A B :| c d |]'],
    ['first and second endings', '|: A B |1 c :|2 d |]'],
    ['a double repeat', 'A B :: c d |]'],
  ])('rejects %s (playing them once would teach the wrong sequence)', (_, body) => {
    const result = parseExercise(header + body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/Repeat signs and endings are not supported yet/)
  })

  test('rejects a tie between different pitches', () => {
    const result = parseExercise(header + 'A- B |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/A tie must join two notes of the same pitch/)
  })

  test('rejects notes below the violin range, which could never be played', () => {
    const result = parseExercise(header + 'F, A |]')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/F♯3 is below the violin's lowest note \(G3\)/)
  })

  test('rejects an exercise without notes', () => {
    expect(parseExercise(header + 'z4 |]')).toEqual({ ok: false, errors: ['The exercise has no notes.'] })
  })

  test('rejects text that is not a tune', () => {
    expect(parseExercise('').ok).toBe(false)
  })

  test('rejects two voices', () => {
    const result = parseExercise('X:1\nL:1/4\nK:C\nV:1\nA B |]\nV:2\nc d |]')
    expect(result.ok).toBe(false)
  })
})
