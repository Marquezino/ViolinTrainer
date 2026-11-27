import type { StreakKind } from '../store/records'

/** One symbol per streak, the same in both languages. */
export const STREAK_SYMBOLS: Record<StreakKind, string> = { easy: '🌱', practice: '🔥' }
