import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { noteKey, type Fingering } from '../music/fingering'
import type { EngineSnapshot } from '../practice/engine'
import { startSession, type TargetState } from '../practice/wait-session'
import type { Exercise, Target } from '../score/exercise'
import { openDatabase, type VtDatabase } from './db'
import { getSettings } from './profiles'
import { attemptFrom, checkpointRun, closeRun, hasPlayableContent } from './runs'

let db: VtDatabase
beforeEach(() => {
  db = openDatabase(`test-${crypto.randomUUID()}`)
})

const START = new Date(2026, 10, 26, 16).getTime()
const A4: Fingering = { string: 'A', finger: 0, mark: null }
const B4: Fingering = { string: 'A', finger: 1, mark: null }
const C5: Fingering = { string: 'A', finger: 2, mark: 'high' }

function target(index: number, midi: number, fingering: Fingering): Target {
  return { index, midi, durationWhole: 0.25, fingering, sourceStarts: [index] }
}

const exercise: Exercise = {
  title: null,
  abc: '',
  targets: [target(0, 69, A4), target(1, 71, B4), target(2, 73, C5)],
  preferFlats: false,
}

const config = {
  tolerances: { greenCents: 20, yellowCents: 35 },
  a4Hz: 440,
  hintDelayMs: 5000,
  initialHint: () => true,
}

const fresh: EngineSnapshot = {
  phase: 'practicing',
  noiseCheckProgress: 1,
  noiseFloorDb: -70,
  noiseProblem: null,
  session: startSession(exercise, config, 0),
  needle: null,
  lastRejection: null,
  result: null,
  activeMs: 0,
}

/** A snapshot with the given target states (the rest untouched) and active time. */
function snapshot(
  states: Partial<TargetState>[],
  activeMs: number,
  phase: EngineSnapshot['phase'] = 'practicing',
): EngineSnapshot {
  const targets = fresh.session.targets.map((t, i) => ({ ...t, ...states[i] }))
  return { ...fresh, phase, activeMs, session: { ...fresh.session, targets, finished: phase === 'finished' } }
}

const green = { color: 'green', redAttempts: 0, centsAtAcceptance: 3 } as const

function attempt(s: EngineSnapshot, finishedAt: number | null) {
  return attemptFrom({ id: 'run-1', profileId: 'p', exerciseId: 'builtin:x', startedAt: START, snapshot: s, finishedAt })
}

test('closeRun twice updates hint states once', async () => {
  const done = attempt(snapshot([green, green, green], 30_000, 'finished'), START + 40_000)
  await closeRun(db, done, exercise)
  await closeRun(db, done, exercise)
  const state = await db.hintStates.get(['p', noteKey(69, A4)])
  expect(state?.consecutiveFirstTryGreens).toBe(1)
  expect(state?.updatedAt).toBe(START + 40_000)
  expect((await getSettings(db)).lastProfileId).toBe('p')
  expect(await db.attempts.count()).toBe(1)
})

test('two closes at once still update hint states once', async () => {
  const done = attempt(snapshot([green, green, green], 30_000, 'finished'), START + 40_000)
  await Promise.all([closeRun(db, done, exercise), closeRun(db, done, exercise)])
  expect((await db.hintStates.get(['p', noteKey(69, A4)]))?.consecutiveFirstTryGreens).toBe(1)
  expect(await db.attempts.count()).toBe(1)
})

test('checkpoint then close: the closed record wins and a later checkpoint is ignored', async () => {
  await checkpointRun(db, attempt(snapshot([green], 5_000), null))
  expect((await db.attempts.get('run-1'))?.activeMs).toBe(5_000)

  const closed = attempt(snapshot([green, green], 9_000), START + 20_000)
  await closeRun(db, closed, exercise)
  // The tablet wakes and a stale checkpoint arrives after the close.
  await checkpointRun(db, attempt(snapshot([green], 6_000), null))

  const stored = await db.attempts.get('run-1')
  expect(stored?.finishedAt).toBe(START + 20_000)
  expect(stored?.activeMs).toBe(9_000)
  expect(stored?.results).toHaveLength(2)
})

test('an abandoned run is saved incomplete with its activeMs and no stars', async () => {
  const left = attempt(snapshot([green, { color: 'yellow', redAttempts: 1, centsAtAcceptance: 30 }], 12_345), START + 60_000)
  await closeRun(db, left, exercise)
  const stored = await db.attempts.get('run-1')
  expect(stored).toMatchObject({
    completed: false,
    stars: 0,
    points: 3,
    maxPoints: 6,
    activeMs: 12_345,
    startedAt: START,
    finishedAt: START + 60_000,
  })
  // The red attempt on the second note resets it; the first note counts one green.
  expect((await db.hintStates.get(['p', noteKey(71, B4)]))?.consecutiveFirstTryGreens).toBe(0)
  expect((await db.hintStates.get(['p', noteKey(69, A4)]))?.consecutiveFirstTryGreens).toBe(1)
  expect(await db.hintStates.get(['p', noteKey(73, C5)])).toBeUndefined()
})

test('a run with nothing played is not saved', () => {
  expect(hasPlayableContent(fresh)).toBe(false)
  expect(hasPlayableContent(snapshot([], 1))).toBe(true)
  expect(hasPlayableContent(snapshot([{ redAttempts: 1 }], 0))).toBe(true)
  expect(hasPlayableContent(snapshot([green], 0))).toBe(true)
})

test('attemptFrom records only reached targets', () => {
  const a = attempt(snapshot([{}, { redAttempts: 2 }, green], 7_000), null)
  expect(a.results).toEqual([
    { targetId: 1, color: null, redAttempts: 2, centsAtAcceptance: null },
    { targetId: 2, color: 'green', redAttempts: 0, centsAtAcceptance: 3 },
  ])
  expect(a).toMatchObject({
    id: 'run-1',
    profileId: 'p',
    exerciseId: 'builtin:x',
    startedAt: START,
    finishedAt: null,
    completed: false,
    points: 2,
    maxPoints: 6,
    stars: 0,
    activeMs: 7_000,
  })
  const done = attempt(snapshot([green, green, green], 7_000, 'finished'), START + 1)
  expect(done).toMatchObject({ completed: true, stars: 3, points: 6 })
})
