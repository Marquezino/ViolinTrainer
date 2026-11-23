import type { AbcProblem } from '../../score/exercise'
import type { Locale } from '../locales'
import { en } from './en'
import { ptBR } from './pt-BR'
import type { Formatters, Messages } from './types'

export type { CentsDirection, Formatters, Messages } from './types'

export const MESSAGES: Record<Locale, Messages> = { en, 'pt-BR': ptBR }

/** The text for one ABC problem (TypeScript cannot call the per-code message on a union directly). */
export function abcProblemText(messages: Messages, problem: AbcProblem, f: Formatters): string {
  const message = messages.abcProblems[problem.code] as (p: AbcProblem, f: Formatters) => string
  return message(problem, f)
}
