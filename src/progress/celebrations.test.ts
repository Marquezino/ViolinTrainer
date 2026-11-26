import { describe, expect, it } from 'vitest'
import { celebrationsFor, goalJustReached, type ProgressSummary } from './celebrations'

const base: ProgressSummary = { todayActiveMs: 0, goalMs: 600_000, easy: 0, practice: 0, bestStars: 0 }

describe('celebrationsFor', () => {
  it('celebrates crossing the goal', () => {
    const after = { ...base, todayActiveMs: 600_000 }
    expect(celebrationsFor({ ...base, todayActiveMs: 500_000 }, after)).toEqual([{ kind: 'goalReached' }])
  })

  it('does not celebrate when the goal was already reached or not reached', () => {
    expect(celebrationsFor({ ...base, todayActiveMs: 700_000 }, { ...base, todayActiveMs: 800_000 })).toEqual([])
    expect(celebrationsFor(base, { ...base, todayActiveMs: 599_999 })).toEqual([])
  })

  it('celebrates a streak reaching 7 but not 7 to 8', () => {
    expect(celebrationsFor({ ...base, easy: 6 }, { ...base, easy: 7 })).toEqual([
      { kind: 'streakMilestone', streak: 'easy', days: 7 },
    ])
    expect(celebrationsFor({ ...base, easy: 7 }, { ...base, easy: 8 })).toEqual([])
  })

  it('celebrates the highest milestone once on a jump', () => {
    expect(celebrationsFor({ ...base, practice: 29 }, { ...base, practice: 31 })).toEqual([
      { kind: 'streakMilestone', streak: 'practice', days: 30 },
    ])
    expect(celebrationsFor({ ...base, practice: 6 }, { ...base, practice: 31 })).toEqual([
      { kind: 'streakMilestone', streak: 'practice', days: 30 },
    ])
  })

  it('celebrates new best stars only when higher', () => {
    expect(celebrationsFor({ ...base, bestStars: 1 }, { ...base, bestStars: 3 })).toEqual([
      { kind: 'newBestStars', stars: 3 },
    ])
    expect(celebrationsFor({ ...base, bestStars: 2 }, { ...base, bestStars: 2 })).toEqual([])
  })
})

describe('goalJustReached', () => {
  it('is true only on the run that crosses the goal', () => {
    expect(goalJustReached(500_000, 100_000, 600_000)).toBe(true)
    expect(goalJustReached(500_000, 99_999, 600_000)).toBe(false)
    expect(goalJustReached(600_000, 10_000, 600_000)).toBe(false)
  })
})
