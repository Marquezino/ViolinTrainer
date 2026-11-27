import { describe, expect, test } from 'vitest'
import { BUILTIN_UNITS } from '../exercises/builtin-units'
import { SAMPLE_EXERCISES } from '../exercises/samples'
import type { AbcProblem, AbcProblemCode } from '../score/exercise'
import { formatters } from './format'
import { LOCALES } from './locales'
import { abcProblemText, MESSAGES } from './messages'
import { en } from './messages/en'
import { ptBR } from './messages/pt-BR'

// One sample per code: adding a code without a sample here fails the type check.
const SAMPLE_PROBLEMS: { [K in AbcProblemCode]: Extract<AbcProblem, { code: K }> } = {
  noTune: { code: 'noTune' },
  multipleTunes: { code: 'multipleTunes' },
  abcSyntax: { code: 'abcSyntax', detail: 'Unknown character ignored: ¤', line: 5, column: 3 },
  multipleVoices: { code: 'multipleVoices' },
  repeats: { code: 'repeats', at: 12 },
  chord: { code: 'chord', at: 12 },
  graceNotes: { code: 'graceNotes', at: 12 },
  tieDifferentPitch: { code: 'tieDifferentPitch', at: 12 },
  unknownPitch: { code: 'unknownPitch', at: 12 },
  belowViolin: { code: 'belowViolin', midi: 53, lowestMidi: 55, at: 12 },
  tooHigh: { code: 'tooHigh', midi: 100, highestMidi: 96, at: 12 },
  fingerFive: { code: 'fingerFive', at: 12 },
  fingerImpossible: { code: 'fingerImpossible', midi: 71, finger: 3, at: 4 },
  outsideFirstPosition: { code: 'outsideFirstPosition', midi: 88, at: 12 },
  noNotes: { code: 'noNotes' },
}

function render(locale: (typeof LOCALES)[number], problem: AbcProblem): string {
  const messages = MESSAGES[locale]
  return abcProblemText(messages, problem, formatters(locale, messages, false))
}

describe.each(LOCALES)('%s messages', (locale) => {
  test.each(Object.values(SAMPLE_PROBLEMS))('ABC problem $code renders', (problem) => {
    const text = render(locale, problem)
    expect(text.trim()).not.toBe('')
    expect(text).not.toMatch(/undefined|NaN|null/)
  })

  test('abcSyntax without a position includes the detail and no "null"', () => {
    const text = render(locale, { code: 'abcSyntax', detail: 'Missing bar', line: null, column: null })
    expect(text).toContain('Missing bar')
    expect(text).not.toContain('null')
  })

  test('every built-in exercise has a title', () => {
    for (const { id } of SAMPLE_EXERCISES) expect(MESSAGES[locale].sampleTitles[id].trim()).not.toBe('')
    for (const { key } of BUILTIN_UNITS) expect(MESSAGES[locale].unitTitles[key].trim()).not.toBe('')
  })
})

describe('note names in messages', () => {
  test('fingerImpossible uses the language notation', () => {
    expect(render('pt-BR', SAMPLE_PROBLEMS.fingerImpossible)).toContain('Si4')
    expect(render('en', SAMPLE_PROBLEMS.fingerImpossible)).toContain('B4')
  })

  test('abcSyntax with a position names line and column', () => {
    expect(render('en', SAMPLE_PROBLEMS.abcSyntax)).toBe(
      'The ABC has a writing error at line 5, column 3: Unknown character ignored: ¤',
    )
    expect(render('pt-BR', SAMPLE_PROBLEMS.abcSyntax)).toBe(
      'O ABC tem um erro de escrita na linha 5, coluna 3: Unknown character ignored: ¤',
    )
  })
})

describe('formatters', () => {
  test('numbers use the locale', () => {
    expect(formatters('pt-BR', ptBR, false).number(1234.5)).toBe('1.234,5')
    expect(formatters('en', en, false).number(1234.5)).toBe('1,234.5')
  })

  test('notes use the language notation and the spelling preference', () => {
    expect(formatters('pt-BR', ptBR, true).note(70)).toBe('Si♭4')
    expect(formatters('en', en, false).note(70)).toBe('A♯4')
  })
})

describe('English texts used by e2e selectors', () => {
  test('stay verbatim', () => {
    expect(en.picker.abcLabel).toBe('ABC notation')
    expect(en.picker.practiceThis).toBe('Practice this')
    expect(en.practice.start).toBe('Start')
    expect(en.profiles.heading).toBe("Who's practising?")
    expect(en.path.back).toBe('← Players')
    expect(en.practice.backToPath).toBe('← Path')
    expect(en.settings.newPlayerName).toBe('New player name')
  })
})

describe('progress texts', () => {
  const f = formatters('en', en, false)
  const fp = formatters('pt-BR', ptBR, false)
  test('practice time is m:ss, rounded down', () => {
    expect(en.path.todayTime(0, 10, f)).toBe('0:00 of 10 min')
    expect(en.path.todayTime(65_999, 10, f)).toBe('1:05 of 10 min')
    expect(ptBR.practice.today(600_000, 15, fp)).toBe('Hoje: 10:00 de 15 min')
  })
  test('counts follow the plural rules', () => {
    expect(en.streaks.label('easy', 1, f)).toBe('Playing streak: 1 day')
    expect(en.streaks.label('practice', 3, f)).toBe('Goal streak: 3 days')
    expect(en.notes.missing(1, f)).toBe('You need 1 more note.')
    expect(ptBR.notes.missing(1, fp)).toBe('Falta 1 nota.')
    expect(ptBR.notes.missing(3, fp)).toBe('Faltam 3 notas.')
    expect(en.backup.confirm(1, 2, f)).toMatch(/^This backup has 1 player and 2 runs\./)
    expect(ptBR.backup.confirm(2, 1, fp)).toMatch(/^Este backup tem 2 jogadores e 1 execução\./)
    expect(ptBR.celebrations.newBestStars(1, fp)).toBe('Novo recorde: 1 estrela!')
  })
  test('streak milestones read naturally and use the symbol of their streak', () => {
    expect(en.celebrations.streakMilestone('easy', 7, f)).toBe('7-day playing streak! 🌱')
    expect(en.celebrations.streakMilestone('practice', 30, f)).toBe('30-day goal streak! 🔥')
    expect(ptBR.celebrations.streakMilestone('easy', 7, fp)).toBe('Sequência de 7 dias tocando! 🌱')
    expect(ptBR.celebrations.streakMilestone('practice', 100, fp)).toBe('Sequência de 100 dias cumprindo a meta! 🔥')
  })
  test('a repair offer names the streak it restores (R4)', () => {
    expect(en.notes.repairOffer(12, '🔥', 40, f)).toBe('Repair to 12 🔥 for 40 ♪')
  })
})

describe('plural-sensitive texts', () => {
  const f = formatters('en', en, false)
  const fp = formatters('pt-BR', ptBR, false)
  test('summary and cents', () => {
    expect(en.practice.summary(1, 1, f)).toMatch(/^1 of 1 point\./)
    expect(en.practice.summary(10, 12, f)).toMatch(/^10 of 12 points\./)
    expect(en.needle.cents(1, 'flat', f)).toBe('1 cent flat')
    expect(en.needle.cents(12, 'sharp', f)).toBe('12 cents sharp')
    expect(ptBR.practice.summary(10, 12, fp)).toMatch(/^10 de 12 pontos\./)
    expect(ptBR.practice.summary(1, 1, fp)).toMatch(/^1 de 1 ponto\./)
  })
})
