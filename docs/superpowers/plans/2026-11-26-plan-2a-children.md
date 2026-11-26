# Plan 2a: The Children's Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profiles, saved progress, a learning path of built-in units, stars and unlocking, persisted hint fading, two streaks with repairs paid in notes, a daily minutes goal, a weekly leaderboard, celebrations, a tuning screen, backups, and an installable app.

**Architecture:**
- **Pure logic:** every decision lives in pure functions under `src/progress/` (days, streaks, notes, unlocking, hints, leaderboard, celebrations) and `src/practice/` (active time, tuning), tested with Vitest.
- **Storage:** `src/store/` wraps a Dexie database and is tested with `fake-indexeddb`.
- **UI:** React screens in `src/ui/` read the database through `dexie-react-hooks` (`useLiveQuery`) and call store functions; they make no decisions themselves.

**Tech Stack:** TypeScript, React 19, Vite 8, Vitest 5, fast-check, Playwright, Dexie 4, dexie-react-hooks, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-26-plan-2-design.md` (Plan 2), built on `docs/superpowers/specs/2026-10-16-violin-trainer-v1-design.md` (v1). Plan 2 spec sections are cited as §n, v1 sections as v1 §n. This plan covers part 2a only (§3). The parent area (PIN, editor, path setup, unit import/export) is part 2b.

## Global Constraints

- Node >= 24. Run all commands from the repository root.
- Branch `plan-2a`. One commit per task at least. Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Privacy:** never write names, ages, relationships or other personal details of the people who use the app anywhere: code, tests, fixtures, docs, commits. Test profiles use generic names ("Player A", "Player B").
- **Copyright:** built-in exercises are written for this project or are traditional melodies, never copied from a method book or a book's arrangement (`src/exercises/samples.ts` header).
- No judging rule changes (§2 anti-goals). `src/analysis/*` and the judging in `src/practice/wait-session.ts` / `engine.ts` stay as they are, except for the additions named in Task 3.
- **Ids:** every stored record gets `crypto.randomUUID()`, except built-in units and exercises, which get fixed ids (`builtin-unit:<name>`, `builtin:<sampleId>`) (§4.2, §5).
- Every record has `createdAt` and `updatedAt` in ms since epoch, where its type lists them.
- Units, exercises and profiles are soft-deleted with `deletedAt`, never erased.
- `Attempt` and `StreakRepair` are never modified after they are closed (§4.2).
- The database name is exactly `violin-trainer` (§4.1).
- All days are local calendar days `YYYY-MM-DD`. A run belongs to the local day it started. Weeks run Monday to Sunday (§6).
- **Constants (§6):**
  - gap rule: up to 2 missed days in a row;
  - active-time gap: 30 000 ms;
  - goal: default 10 minutes, range 5 to 60, step 5;
  - notes: 5 ♪ per goal day, 1 ♪ per best star;
  - repairs: easy 20 ♪, practice 40 ♪;
  - streak milestones: 7, 30, 100, 365;
  - hints: a note is learned after 5 first-try greens (v1 §6.3);
  - backup reminder: after 14 days, dismissed for 7 days (§4.1);
  - tuning screen: green within ±5 cents (§7.4).
- **Text:** every new UI string goes into `src/i18n/messages/types.ts` and is translated in both `en.ts` and `pt-BR.ts` in the same task. No hard-coded user-facing text in components.
- **Layout:** children's screens (picker, path, leaderboard, tuning, summary) are designed first for a tablet held sideways (about 1280×800), with tap targets at least 48 px, and still work at 1440×900 and in portrait. The settings screen may be laptop-first.
- Animations respect `prefers-reduced-motion: reduce`. No sound effects.
- **Quality gates for every task:** `npm run typecheck` and `npm test` pass. Tasks that change UI also pass `npm run e2e`.

## Review Focus

1. **A run that crosses midnight, or a daylight-saving change, lands on the wrong day or breaks a streak.** The run must count for the day it started, and day arithmetic must never skip or repeat a day. Pinned in Task 1 (TZ `America/New_York` in Vitest) and Task 4.
2. **The child closes the app or the tablet sleeps mid-run, and the minutes are lost or the hints are updated twice.** Expected: minutes up to the last note are kept, and hints are updated exactly once per run. Pinned in Task 9.
3. **A wrong or damaged file is chosen in "Import backup".** That includes a file from another app, truncated JSON, or a backup from a newer app version. Expected: a clear refusal, with the current data untouched. Pinned in Task 10.
4. **First run and empty states:** no profiles, a profile with no attempts, every unit hidden or deleted, a leaderboard with one profile. Expected: friendly empty screens, no crash, and the first exercise unlocked. Pinned in Tasks 6, 11 and 12.
5. **A built-in upgrade removes or reorders an exercise a child already played.** Expected: attempts, minutes and streaks are kept, and nothing the child played locks again (§6.5). Pinned in Tasks 6 and 8.

---

## File Structure

**New, pure logic:**
- `src/progress/days.ts`: local day strings and arithmetic.
- `src/practice/active-time.ts`: active minutes of a run.
- `src/progress/history.ts`: goal days, practice days, minutes per day, from records.
- `src/progress/streaks.ts`: the shared gap rule and counting back from today.
- `src/progress/notes.ts`: notes balance, repair offers, repair records.
- `src/progress/unlocking.ts`: best stars, unlocked exercises, next to play.
- `src/progress/hints.ts`: hint-state updates and the learned rule.
- `src/progress/leaderboard.ts`: weekly ranking.
- `src/progress/celebrations.ts`: what to celebrate after a run.
- `src/progress/backup-reminder.ts`: when to show the reminder.
- `src/practice/tuning.ts`: nearest open string and cents.

**New, storage:**
- `src/store/records.ts`: record types.
- `src/store/db.ts`: the Dexie schema and opening.
- `src/store/profiles.ts`: profiles, goals, settings.
- `src/store/history.ts`: loading a profile's history.
- `src/store/runs.ts`: saving attempts and hint states.
- `src/store/repairs.ts`: paying for a repair.
- `src/store/builtin.ts`: syncing built-in units.
- `src/store/backup.ts`: export and import.
- `src/store/persistence.ts`: `navigator.storage.persist()`.

**New, content:** `src/exercises/builtin-units.ts`.

**New, UI:**
- `src/ui/DbProvider.tsx`
- `src/ui/ProfilePicker.tsx`
- `src/ui/PathScreen.tsx`
- `src/ui/SettingsScreen.tsx`
- `src/ui/LeaderboardScreen.tsx`
- `src/ui/TuningScreen.tsx`
- `src/ui/Celebration.tsx`
- `src/ui/BackupReminder.tsx`
- `src/ui/TryAbcScreen.tsx` (the Plan 1 "Your own ABC" box, moved)
- `src/ui/useRunRecorder.ts`
- `src/ui/useTuner.ts`

**New, app:** `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `scripts/make-icons.ts`.

**Modified:**
- `src/App.tsx`: screen routing.
- `src/main.tsx`: opening the database at startup.
- `src/practice/engine.ts`: adds `activeMs` to the snapshot.
- `src/ui/PracticeScreen.tsx`: profile config, run saving, summary additions.
- `src/exercises/samples.ts`: new traditional tunes.
- `src/i18n/messages/*`
- `src/index.css`
- `index.html`
- `vite.config.ts`: Vitest TZ.
- `e2e/*.spec.ts`
- `README.md`, `AGENTS.md`

**Removed:** `src/ui/ExercisePicker.tsx`, replaced by `ProfilePicker`, `PathScreen` and `TryAbcScreen`.

---

### Task 1: Local days

**Files:**
- Create: `src/progress/days.ts`
- Test: `src/progress/days.test.ts`
- Modify: `vite.config.ts` (add `test.env: { TZ: 'America/New_York' }`, a zone with daylight saving, so day arithmetic is tested across DST changes)

**Interfaces:**
- Produces:
  - `localDay(ms: number): Day`, the local date of an instant;
  - `addDays(day: Day, n: number): Day`, which works on the calendar date, never by adding 24 h;
  - `weekStart(day: Day): Day`, the Monday on or before `day`;
  - `daysOfWeek(day: Day): Day[]`, the 7 days Monday to Sunday of that week;
  - `compareDays(a: Day, b: Day): number`.

- [ ] **Step 1: Write the failing tests**

- `test('localDay uses local time')`: `localDay(new Date(2026, 2, 8, 23, 59).getTime()) === '2026-03-08'`.
- `test('addDays crosses DST changes without skipping or repeating')`:
  - `addDays('2026-03-07', 1) === '2026-03-08'`;
  - `addDays('2026-03-08', 1) === '2026-03-09'` (US spring-forward day);
  - `addDays('2026-11-01', 1) === '2026-11-02'` (fall-back day);
  - `addDays('2026-03-01', -1) === '2026-02-28'`.
- `test('weekStart is Monday')`: `weekStart('2026-11-29') === '2026-11-23'` (a Sunday) and `weekStart('2026-11-23') === '2026-11-23'`.
- `test('daysOfWeek returns Monday..Sunday')`: the length is 7, with the first `'2026-11-23'` and the last `'2026-11-29'`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/progress/days.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Parse `Day` into `new Date(y, m - 1, d, 12)`, local noon, and step with `setDate`.
  - Format with zero-padded local fields.

- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/progress/days.test.ts && npm test`. Expected: PASS. The existing tests must also still pass under the new TZ.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/progress/days.ts src/progress/days.test.ts
git commit -m "feat: local day arithmetic, tested across daylight-saving changes"
```

---

### Task 2: Storage foundation

**Files:**
- Create: `src/store/records.ts`, `src/store/db.ts`, `src/store/profiles.ts`, `src/store/persistence.ts`
- Test: `src/store/db.test.ts`, `src/store/profiles.test.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces, in `src/store/records.ts` (types only):
  ```ts
  export type Day = string // 'YYYY-MM-DD', local calendar day
  export type Avatar = 'violin' | 'note' | 'clef' | 'star' | 'sun' | 'moon' | 'bird' | 'cat' | 'dog' | 'flower' | 'tree' | 'heart'
  export interface Profile { id: string; name: string; avatar: Avatar; greenCents: number; yellowCents: number; locale: Locale; skipTuning: boolean; createdAt: number; updatedAt: number; deletedAt: number | null }
  export interface GoalSetting { id: string; profileId: string; minutes: number; fromDay: Day; createdAt: number }
  export interface Settings { id: 'app'; a4Hz: number; lastProfileId: string | null; lastBackupAt: number | null; backupReminderDismissedAt: number | null }
  export type UnitSource = 'builtin' | 'imported' | 'local'
  export interface Unit { id: string; title: string; order: number; source: UnitSource; sourceVersion: number | null; createdAt: number; updatedAt: number; deletedAt: number | null }
  export interface ExerciseRecord { id: string; unitId: string; order: number; title: string; abc: string; transpose: number; createdAt: number; updatedAt: number; deletedAt: number | null }
  export interface TargetResult { targetId: number; color: 'green' | 'yellow' | null; redAttempts: number; centsAtAcceptance: number | null }
  export interface Attempt { id: string; profileId: string; exerciseId: string; startedAt: number; finishedAt: number | null; completed: boolean; points: number; maxPoints: number; stars: Stars; activeMs: number; results: TargetResult[] }
  export interface HintState { profileId: string; noteKey: string; consecutiveFirstTryGreens: number; updatedAt: number }
  export interface ManualUnlock { id: string; profileId: string; exerciseId: string; createdAt: number }
  export type StreakKind = 'easy' | 'practice'
  export interface StreakRepair { id: string; profileId: string; streak: StreakKind; day: Day; cost: number; createdAt: number }
  ```
  - `skipTuning` is per profile (§7.4). The spec's record list omits it; it belongs on `Profile`.
  - `finishedAt === null` means the run is still open, or the app died before it closed. Its `activeMs` still counts (§6.3).
- Produces, in `src/store/db.ts`:
  - `DB_NAME = 'violin-trainer'`, `SCHEMA_VERSION = 1`;
  - `class VtDatabase extends Dexie`, with tables:
    - `profiles: Table<Profile, string>`
    - `goalSettings: Table<GoalSetting, string>`
    - `settings: Table<Settings, 'app'>`
    - `units: Table<Unit, string>`
    - `exercises: Table<ExerciseRecord, string>`
    - `attempts: Table<Attempt, string>`
    - `hintStates: Table<HintState, [string, string]>`
    - `manualUnlocks: Table<ManualUnlock, string>`
    - `streakRepairs: Table<StreakRepair, string>`
  - `openDatabase(name?: string): VtDatabase`
  - `type TableName = 'profiles' | 'goalSettings' | 'settings' | 'units' | 'exercises' | 'attempts' | 'hintStates' | 'manualUnlocks' | 'streakRepairs'`;
  - `TABLE_NAMES: readonly TableName[]`, the list of the nine tables, used by backup.
- Produces, in `src/store/profiles.ts`:
  - `DEFAULT_SETTINGS: Omit<Settings, 'id'>`, with `a4Hz` set to `DEFAULT_A4_HZ`;
  - `getSettings(db): Promise<Settings>`, which creates the row with defaults if it is missing;
  - `updateSettings(db, patch: Partial<Omit<Settings, 'id'>>): Promise<void>`;
  - `createProfile(db, input: { name: string; avatar: Avatar; locale: Locale }, now: number): Promise<Profile>`, which uses `DEFAULT_TOLERANCES`, sets `skipTuning: false`, and adds a `GoalSetting` of `DEFAULT_GOAL_MINUTES` from `localDay(now)`;
  - `updateProfile(db, id, patch: Partial<Pick<Profile, 'name' | 'avatar' | 'greenCents' | 'yellowCents' | 'locale' | 'skipTuning'>>, now): Promise<void>`;
  - `deleteProfile(db, id, now): Promise<void>`, which only sets `deletedAt`;
  - `listProfiles(db): Promise<Profile[]>`: not deleted, ordered by `createdAt`;
  - `setGoal(db, profileId, minutes: number, today: Day, now: number): Promise<void>`. It throws `RangeError` unless `minutes` is 5 to 60 in steps of 5. A second change on the same day replaces that day's setting, so `fromDay` stays unique per profile.
  - `GOAL_MIN = 5`, `GOAL_MAX = 60`, `GOAL_STEP = 5`, `DEFAULT_GOAL_MINUTES = 10`.
- Produces, in `src/store/persistence.ts`:
  - `type PersistenceStatus = 'granted' | 'denied' | 'unsupported'`;
  - `requestPersistentStorage(): Promise<PersistenceStatus>`, which calls `navigator.storage.persisted()`, then `persist()` if needed;
  - `persistenceStatus(): Promise<PersistenceStatus>`.
- Consumes `Locale` from `src/i18n/locales.ts`, `Stars` from `src/practice/scoring.ts`, `DEFAULT_TOLERANCES` / `DEFAULT_A4_HZ` from `src/music/pitch.ts`, and `localDay` from Task 1.

**Indexes:**
- `profiles: 'id'`
- `goalSettings: 'id, profileId'`
- `settings: 'id'`
- `units: 'id, order'`
- `exercises: 'id, unitId'`
- `attempts: 'id, profileId, exerciseId'`
- `hintStates: '[profileId+noteKey], profileId'`
- `manualUnlocks: 'id, profileId'`
- `streakRepairs: 'id, profileId'`

- [ ] **Step 1: Install dependencies**

Run: `npm install dexie dexie-react-hooks fake-indexeddb`

Expected: all three appear under `dependencies`. `fake-indexeddb` is also the private-window fallback in Task 11, so it is a dependency, not a dev dependency.

- [ ] **Step 2: Write the failing tests**

Each test file starts with `import 'fake-indexeddb/auto'` and opens `openDatabase(\`test-${crypto.randomUUID()}\`)`, so tests don't share data.

`src/store/db.test.ts`:
- `test('opens with the app-specific name and schema version 1')`: `openDatabase().name === 'violin-trainer'`, and `db.verno === 1` after `db.open()`.
- `test('TABLE_NAMES lists every table')`: it is equal to `db.tables.map(t => t.name)` sorted.

`src/store/profiles.test.ts`:
- `test('createProfile gives a UUID, default tolerances, and a 10-minute goal from today')`: the id matches `/^[0-9a-f-]{36}$/`; `greenCents` is 20 and `yellowCents` is 35; one `goalSettings` row has `minutes` 10 and `fromDay` equal to `localDay(now)`.
- `test('deleteProfile hides the profile but keeps the record')`: `listProfiles` no longer includes it, and `db.profiles.get(id)` has a numeric `deletedAt`.
- `test('setGoal rejects values outside 5..60 or off the 5-minute step')`: 4, 61 and 12 throw `RangeError`; 5 and 60 succeed.
- `test('setGoal twice on one day keeps one setting for that day')`: after `setGoal(…, 15, day)` then `setGoal(…, 20, day)`, there is exactly one row with that `fromDay` and its `minutes` is 20.
- `test('getSettings creates defaults once')`: `a4Hz` is 440, and calling it twice leaves exactly one row.

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run src/store`

Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `records.ts`, `db.ts`, `profiles.ts`, `persistence.ts` as specified above**

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/store && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/store
git commit -m "feat: Dexie storage with profiles, goals and settings"
```

---

### Task 3: Active minutes in the engine

**Files:**
- Create: `src/practice/active-time.ts`
- Modify: `src/practice/engine.ts`, adding `activeMs` to `EngineSnapshot`
- Test: `src/practice/active-time.test.ts`, `src/practice/engine.test.ts`, which gets one added test

**Interfaces:**
- Produces:
  - `ACTIVE_GAP_MS = 30_000`;
  - `class ActiveTimer { constructor(startMs: number); noteAt(ms: number): void; get activeMs(): number }`.
    - `activeMs` sums the gaps between consecutive points among the start and every note time, counting only gaps shorter than `ACTIVE_GAP_MS`.
    - It ends at the last note, so an abandoned run counts up to its last note (§6.3).
  - `EngineSnapshot.activeMs: number`:
    - 0 during the room check;
    - after that, the timer started at the frame time when practice began, and fed with every `NoteEvent` the tracker emits. That includes adjustments and same-attempt events: "Both accepted and rejected note events count".

- [ ] **Step 1: Write the failing tests**

`active-time.test.ts`:
- `test('counts time up to the last note')`: start 0; notes at 1000 and 5000 give `activeMs` 5000.
- `test('drops gaps of 30 s or more')`: start 0; notes at 1000, 31000 (a 30 000 ms gap) and 32000 give `activeMs` 2000.
- `test('a gap just under 30 s counts')`: start 0; a note at 29999 gives 29999.
- `test('no notes means zero')`: start 0, no notes, gives 0.

`engine.test.ts`, using the existing synthetic-tone helpers in this file:
- `test('activeMs grows with note events and is 0 during the room check')`:
  - during `measuringNoise`, `snapshot().activeMs === 0`;
  - after two notes about 650 ms apart, `activeMs` is between 500 and 2000.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/practice`. Expected: FAIL.

- [ ] **Step 3: Implement `ActiveTimer`, and wire it into `PracticeEngine`**:
  - create it in `measureNoise` when the phase becomes `practicing`;
  - call `noteAt(frame.timeMs)` for every non-null `note` in `practice()`.

- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/practice`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice
git commit -m "feat: measure active practice time in the engine"
```

---

### Task 4: History, streaks, notes and repairs (pure)

**Files:**
- Create: `src/progress/history.ts`, `src/progress/streaks.ts`, `src/progress/notes.ts`
- Test: `src/progress/streaks.test.ts`, `src/progress/notes.test.ts`, `src/progress/history.test.ts`

**Interfaces:**
- Produces, in `history.ts`:
  - `interface ProfileHistory { attempts: readonly Attempt[]; goals: readonly GoalSetting[]; repairs: readonly StreakRepair[] }`
  - `goalMinutesOn(goals, day: Day): number`: the latest setting with `fromDay <= day`; `DEFAULT_GOAL_MINUTES` if none.
  - `activeMsByDay(attempts): Map<Day, number>`, keyed by `localDay(attempt.startedAt)`.
  - `goalDays(h: ProfileHistory): Set<Day>`
  - `practiceDays(h: ProfileHistory): Set<Day>`: days with a completed attempt, plus every goal day (§6.1).
  - `completedRunsOn(attempts, days: readonly Day[]): number`
- Produces, in `streaks.ts`:
  - `MAX_MISSED_IN_A_ROW = 2`
  - `streakLength(counting: ReadonlySet<Day>, repaired: ReadonlySet<Day>, today: Day): number`
    1. If `today` is in `counting`, start at today; otherwise start at yesterday, since today is skipped, not missed.
    2. Walk back day by day, keeping a run of missed days (a day neither counting nor repaired). Stop when the run reaches 3; the stretch ends after those days.
    3. Return the number of `counting` days in the stretch. Repaired days don't add.
    4. Stop walking at the earliest counting or repaired day; no history means 0.
  - `brokenYesterday(counting, repaired, today: Day): number | null`:
    - returns `null` unless yesterday, the day before and the day before that are all missed, meaning yesterday was the 3rd missed day in a row;
    - otherwise returns `streakLength(counting, repaired ∪ {yesterday}, today)`, the number the repair would restore;
    - also returns `null` when that number is 0.
  - `streaks(h: ProfileHistory, today: Day): { easy: number; practice: number }`. It uses `practiceDays`/`goalDays` and the repairs of each kind.
- Produces, in `notes.ts`:
  - `NOTES_PER_GOAL_DAY = 5`, `EASY_REPAIR_COST = 20`, `PRACTICE_REPAIR_COST = 40`;
  - `notesBalance(h: ProfileHistory, bestStarsSum: number): number`, which is 5 × the number of goal days, plus `bestStarsSum`, minus the sum of repair costs. `bestStarsSum` comes from Task 6's `bestStars`; passing it in keeps this module independent of unlocking.
  - `interface RepairOffer { streak: StreakKind; day: Day; cost: number; restores: number; affordable: boolean; missing: number }`
  - `repairOffers(h, bestStarsSum, today: Day): RepairOffer[]`: zero to two offers, practice first.
  - `repairRecords(h, offer: RepairOffer, profileId: string, now: number, newId: () => string): StreakRepair[]`:
    - an easy offer gives one record with cost 20;
    - a practice offer gives a practice record with cost 40, plus an easy record with cost 0 for the same day unless that day is already in `practiceDays(h)`. This is the rule from §6.7 that keeps easy ≥ practice.

- [ ] **Step 1: Write the failing tests** (fixtures as `Set`s of days; `today = '2026-11-27'`, a Friday)

`streaks.test.ts`:
- `test('spec example: Mon ✓ Tue ✗ Wed ✗ Thu ✗ Fri ✓ gives 1')`: counting `{'2026-11-23','2026-11-27'}` gives 1.
- `test('two misses in a row are forgiven')`: counting `{'2026-11-23','2026-11-26','2026-11-27'}` gives 3.
- `test('today not yet practised is skipped, not missed')`: counting `{'2026-11-24','2026-11-25','2026-11-26'}` gives 3.
- `test('a repaired day stops a miss run but does not add')`: counting `{'2026-11-21','2026-11-27'}` with repaired `{'2026-11-24'}` gives 2. The misses are 22–23, then the repaired 24, then 25–26.
- `test('no history is 0')`.
- `test('streaks cross DST and month ends')`: daily counting from `'2026-10-25'` to `'2026-11-03'` (the US fall-back day is `'2026-11-01'`) with today `'2026-11-03'` gives 10.
- `test('brokenYesterday offers only the day after the 3rd miss')`:
  - counting `{'2026-11-20','2026-11-23'}` (missed 24, 25, 26): `brokenYesterday(…, '2026-11-27')` is 2;
  - with today `'2026-11-28'`, it is `null` (the day has passed);
  - counting `{'2026-11-25'}` (missed only 26) gives `null`.
- `test('property: easy streak >= practice streak')`, with fast-check:
  - random histories over 60 days, each day randomly none, completed-run-only, or goal day;
  - random goal settings;
  - random repairs, built only through `repairOffers` + `repairRecords`, applied in day order;
  - assert `streaks(h, today).easy >= streaks(h, today).practice` for every day as `today`.

`notes.test.ts`:
- `test('balance: 5 per goal day plus best stars minus repairs')`: 3 goal days, `bestStarsSum` 4 and one repair of 20 give 5×3 + 4 − 20 = −1. A negative balance can't be reached through `repairOffers`; the test only checks the formula.
- `test('practice repair also repairs the easy streak unless that day was a practice day')`. Two cases:
  - yesterday has no completed run: two records, practice with cost 40 and easy with cost 0;
  - yesterday had a completed run but no goal: one record.
- `test('offer is not affordable with too few notes and says how many are missing')`: balance 15 and an easy offer give `affordable: false`, `missing: 5`.

`history.test.ts`:
- `test('a run that starts at 23:58 counts for that day')`.
- `test('goal changes apply from their day on; past days keep their goal')`.
- `test('an unfinished run counts toward minutes but not as a completed run')`.
- `test('a goal day is a practice day even with no completed run')`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/progress`. Expected: FAIL.

- [ ] **Step 3: Implement the three modules as specified.**

- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/progress`. Expected: PASS, including the property.

- [ ] **Step 5: Commit**

```bash
git add src/progress
git commit -m "feat: goal days, two streaks with a shared gap rule, notes and repairs"
```

---

### Task 5: Hint fading (pure)

**Files:**
- Create: `src/progress/hints.ts`
- Test: `src/progress/hints.test.ts`

**Interfaces:**
- Produces:
  - `LEARNED_AFTER = 5`;
  - `hintCounts(states: readonly HintState[]): Map<string, number>`;
  - `updateHintCounts(exercise: Exercise, results: readonly TargetResult[], counts: Map<string, number>): Map<string, number>`, which returns a new map:
    - targets are processed in target order and skipped when `fingering === null`;
    - a result with `redAttempts > 0` resets that key to 0;
    - `color === 'green'` with `redAttempts === 0` adds 1;
    - yellow, and targets never reached, change nothing (v1 §6.3).
  - `initialHintFor(counts: Map<string, number>): (target: Target) => boolean`: true unless the count for `noteKey(target.midi, target.fingering)` is at least 5. It is passed as `SessionConfig.initialHint`.

- [ ] **Step 1: Write the failing tests**
- `test('five first-try greens in a row hide the hint')`: 4 greens leave the hint visible; the 5th hides it.
- `test('a red attempt resets the key and a yellow neither counts nor resets')`.
- `test('the same note twice in one run counts twice, in order')`: green then red on the same key ends at 0.
- `test('targets outside first position are ignored')`.
- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/progress/hints.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat: hint fading per learned note"`.

---

### Task 6: Unlocking, best stars and the leaderboard (pure)

**Files:**
- Create: `src/progress/unlocking.ts`, `src/progress/leaderboard.ts`
- Test: `src/progress/unlocking.test.ts`, `src/progress/leaderboard.test.ts`

**Interfaces:**
- Produces, in `unlocking.ts`:
  - `UNLOCK_STARS = 2`;
  - `bestStars(attempts): Map<string, Stars>`, keyed by `exerciseId`, from completed attempts;
  - `bestStarsSum(best: Map<string, Stars>): number`;
  - `unlockedExercises(path: readonly string[], attempts, manualUnlocks: readonly string[]): Set<string>`. The `path` is the exercise ids of the visible units and exercises in order, with deleted ones left out. An exercise is unlocked when:
    - it is `path[0]`;
    - or the exercise before it in `path` has best stars of 2 or more;
    - or the profile has any attempt on it, whatever its position;
    - or it is in `manualUnlocks`.

    The result only contains ids in `path`.
  - `nextToPlay(path, unlocked, best): string | null`: the first unlocked id with best stars under 2; otherwise the last unlocked id; `null` for an empty path.
- Produces, in `leaderboard.ts`:
  - `interface LeaderboardRow { profileId: string; place: number; goalDays: number; completedRuns: number; week: boolean[] }`. `week` has 7 entries, Monday to Sunday: whether each day was a goal day.
  - `weeklyLeaderboard(entries: readonly { profileId: string; history: ProfileHistory }[], today: Day): LeaderboardRow[]`:
    - sorted by `goalDays` descending, then `completedRuns` descending;
    - equal pairs share a place (1, 1, 3);
    - only days of `daysOfWeek(today)` count;
    - stars never enter (§6.4).

- [ ] **Step 1: Write the failing tests**

`unlocking.test.ts`:
- `test('first exercise is always unlocked; the next one unlocks at 2 stars')`.
- `test('unlocking runs across units')`: the path is the flattened ids of two units.
- `test('an exercise with any attempt stays unlocked after it moves later in the path')`.
- `test('empty path unlocks nothing and nextToPlay is null')`.
- `test('deleted exercises are not in the result even if played')`: they aren't in `path`, so they aren't returned.

`leaderboard.test.ts`:
- `test('ranks by goal days, then completed runs, with shared places')`.
- `test('stars do not affect the ranking')`.
- `test('only this Monday..Sunday counts')`.
- `test('a single profile is place 1')`.

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat: unlocking that never relocks, and a weekly effort leaderboard"`.

---

### Task 7: Celebrations and the backup reminder (pure)

**Files:**
- Create: `src/progress/celebrations.ts`, `src/progress/backup-reminder.ts`
- Test: `src/progress/celebrations.test.ts`, `src/progress/backup-reminder.test.ts`

**Interfaces:**
- Produces, in `celebrations.ts`:
  - `STREAK_MILESTONES = [7, 30, 100, 365] as const`;
  - `interface ProgressSummary { todayActiveMs: number; goalMs: number; easy: number; practice: number; bestStars: Stars }`. Here `bestStars` is the best on the exercise just played.
  - `type Celebration = { kind: 'goalReached' } | { kind: 'streakMilestone'; streak: StreakKind; days: number } | { kind: 'newBestStars'; stars: Stars }`;
  - `celebrationsFor(before: ProgressSummary, after: ProgressSummary): Celebration[]`:
    - `goalReached` when the run crossed the goal;
    - a milestone when a streak crossed one, at most one per streak, the highest crossed;
    - `newBestStars` when `after.bestStars > before.bestStars`.
  - `goalJustReached(beforeRunMs: number, liveActiveMs: number, goalMs: number): boolean`, for the banner during a run.
- Produces, in `backup-reminder.ts`:
  - `REMIND_AFTER_MS = 14 * 86_400_000`, `SNOOZE_MS = 7 * 86_400_000`;
  - `shouldShowBackupReminder(s: { hasAttempts: boolean; lastBackupAt: number | null; dismissedAt: number | null; now: number }): boolean`:
    - true when `hasAttempts`;
    - and `lastBackupAt` is null or at least 14 days ago;
    - and `dismissedAt` is null or at least 7 days ago.
- [ ] **Step 1: Write the failing tests**:
  - goal crossed and not crossed;
  - a streak going 6→7 celebrates 7, and 7→8 celebrates nothing;
  - a jump 29→31 celebrates 30 once;
  - new best stars, and equal stars;
  - reminder: no attempts gives false; never backed up gives true; backed up 13 days ago gives false; 14 days ago gives true; dismissed 6 days ago gives false.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat: celebration and backup-reminder rules"`.

---

### Task 8: Built-in units and the traditional tunes

**Files:**
- Modify: `src/exercises/samples.ts` (add six tunes), `src/i18n/messages/{types,en,pt-BR}.ts` (`sampleTitles`, plus a new `unitTitles`)
- Create: `src/exercises/builtin-units.ts`, `src/store/builtin.ts`
- Test: `src/exercises/samples.test.ts`, which already covers new samples through `test.each`; `src/store/builtin.test.ts`

**Interfaces:**
- `SampleId` gains `'lightly-row' | 'song-of-the-wind' | 'go-tell-aunt-rhody' | 'o-come-little-children' | 'may-song' | 'long-long-ago'`.
- Produces, in `builtin-units.ts`:
  - `type BuiltinUnitId = 'first-steps' | 'traditional-tunes'`;
  - `interface BuiltinUnit { id: string; key: BuiltinUnitId; version: number; exercises: readonly SampleId[] }`. Unit ids are `builtin-unit:first-steps` and `builtin-unit:traditional-tunes`, and both start at version 1.
  - `BUILTIN_UNITS: readonly BuiltinUnit[]`:
    - First steps: the five Plan 1 samples, in their current order;
    - Traditional tunes: the six new samples, in the order above.
  - `builtinExerciseId(id: SampleId): string`, returning `'builtin:' + id`;
  - `sampleIdOf(exerciseId: string): SampleId | null`, the reverse, which the UI uses to translate titles;
  - `unitKeyOf(unitId: string): BuiltinUnitId | null`.
- Produces, in `store/builtin.ts`:
  - `syncBuiltinUnits(db, now: number, units: readonly BuiltinUnit[] = BUILTIN_UNITS): Promise<void>`, run in one transaction:
    - a unit that is missing is inserted, with `source: 'builtin'`, `sourceVersion = version` and `order` equal to its index;
    - a unit with a stored `sourceVersion` lower than its version is updated in place:
      - exercises in the list are upserted, with `order` equal to their index and `deletedAt` set to null;
      - exercises no longer listed get `deletedAt = now`;
      - `updatedAt` is set to `now`;
    - an equal or higher stored version leaves the unit untouched;
    - the `ExerciseRecord` title and abc come from `SAMPLE_EXERCISES`.
- **Messages:** `sampleTitles` gets six new entries in both languages. Use the known Portuguese titles where one exists, otherwise translate: *Lightly Row* is "Remar, remar"; *O Come, Little Children* is "Vinde, meninos"; *Long, Long Ago* is "Há muito tempo"; the implementer chooses the others. New `unitTitles: Record<BuiltinUnitId, string>` in both languages: "First steps" / "Primeiros passos", "Traditional tunes" / "Melodias tradicionais".

**The tunes.** Write each in `K:A`, entirely within G3–B5 and in first position, with repeats written out. Header comment: these are traditional melodies written fresh for this project.

Three are given here, so the melodies are pinned:

```
T:Lightly Row (traditional)
M:4/4
L:1/4
K:A
e c c2 | d B B2 | A B c d | e e e2 | e c c2 | d B B2 | A c e e | c4 |
B B B B | B c d2 | c c c c | c d e2 | e c c2 | d B B2 | A c e e | A4 |]
```

```
T:Song of the Wind (traditional)
M:2/4
L:1/8
K:A
A B c d | e e e2 | f d a f | e4 | f d a f | e4 | e d d d | d c c c | c B B B | B A c e | A4 |]
```

```
T:Go Tell Aunt Rhody (traditional)
M:4/4
L:1/4
K:A
c2 c B | A2 A2 | B B d c | B2 A2 | e2 e d | c2 c2 | B A B c | A4 |]
```

The implementer writes *O Come, Little Children* (melody by J. A. P. Schulz, 1794), *May Song* (the German folk song "Alle Vögel sind schon da") and *Long, Long Ago* (T. H. Bayly, 1833) from the traditional melody in the same style. They must not consult or copy any method book. Mark these three in the PR's manual test list: a parent checks them by ear.

- [ ] **Step 1: Write the failing tests** in `src/store/builtin.test.ts`:
- `test('first sync inserts both units and all eleven exercises with fixed ids')`.
- `test('sync is idempotent')`: a second call changes no `updatedAt`.
- `test('a newer version updates in place, keeps ids, and soft-deletes removed exercises')`:
  - call with a modified copy of `BUILTIN_UNITS` at version 2 that drops one exercise and reorders two;
  - the dropped one has `deletedAt`;
  - the others keep their ids, with the new order;
  - an `Attempt` on the dropped exercise is still in `db.attempts`.
- `test('an older version in code never downgrades the stored unit')`.

Also add to `samples.test.ts`: `test('every unit lists existing samples, and every sample is in exactly one unit')`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/exercises src/store/builtin.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add the tunes, units, messages, and `syncBuiltinUnits`.**
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npm test && npm run typecheck`. Expected: PASS. The existing `test.each` checks each new tune parses with no errors or warnings and stays in first position.
- [ ] **Step 5: Commit** with `git commit -m "feat: built-in units with traditional Suzuki Book 1 tunes"`.

---

### Task 9: Saving runs

**Files:**
- Create: `src/store/history.ts`, `src/store/runs.ts`, `src/store/repairs.ts`, `src/ui/useRunRecorder.ts`
- Test: `src/store/runs.test.ts`, `src/store/repairs.test.ts`

**Interfaces:**
- Produces, in `store/history.ts`:
  - `loadHistory(db, profileId): Promise<ProfileHistory>`;
  - `loadPath(db): Promise<{ units: Unit[]; exercises: ExerciseRecord[]; path: string[] }>`: units not deleted, sorted by `order`, each with its non-deleted exercises sorted by `order`. `path` is the flattened ids.
- Produces, in `store/runs.ts`:
  - `attemptFrom(input: { id: string; profileId: string; exerciseId: string; startedAt: number; snapshot: EngineSnapshot; finishedAt: number | null }): Attempt`:
    - `completed` is `snapshot.phase === 'finished'`;
    - points and stars come from `scoreRun(snapshot.session.targets, completed)`;
    - `activeMs` comes from `snapshot.activeMs`;
    - `results` has one entry per target that has a color or `redAttempts > 0`, with `targetId` set to the target index.
  - `checkpointRun(db, attempt: Attempt): Promise<void>`: `put`s the attempt while it is open. It is a no-op if the stored copy already has `finishedAt !== null`.
  - `closeRun(db, attempt: Attempt, exercise: Exercise): Promise<void>`. It runs in one transaction and does nothing if the stored copy is already closed. Otherwise it:
    - `put`s the attempt with `finishedAt` set;
    - applies `updateHintCounts` to the profile's `hintStates` once;
    - sets `Settings.lastProfileId`.
  - `hasPlayableContent(snapshot): boolean`: `activeMs > 0`, or any target with a color or a red attempt. Runs without it are not saved.
- Produces, in `store/repairs.ts`: `repairStreak(db, profileId, streak: StreakKind, now: number): Promise<void>`. In one transaction it:
  - loads the history;
  - recomputes `repairOffers` for `localDay(now)`;
  - throws `Error('noOffer')` if there's no matching offer, or `Error('notAffordable')` if the profile can't pay;
  - otherwise `bulkAdd`s the `repairRecords`.
- Produces, in `ui/useRunRecorder.ts`: `useRunRecorder(params: { db: VtDatabase; profileId: string; exerciseId: string; exercise: Exercise; snapshot: EngineSnapshot | null }): void`.
  - When the snapshot first reaches `practicing`, it fixes the attempt `id` (a UUID) and `startedAt = Date.now()`, wall-clock time for the day.
  - When the phase becomes `finished`, it calls `closeRun` once.
  - On `document.visibilitychange` to `hidden`, it calls `checkpointRun`.
  - On unmount, meaning the player leaves, it calls `closeRun` with the latest snapshot, if `hasPlayableContent`.
  - A restart ("Play again") closes the current attempt and begins a new one.

- [ ] **Step 1: Write the failing tests**

`runs.test.ts`:
- `test('closeRun twice updates hint states once')`: after two calls on the same attempt, a key that got one first-try green has count 1.
- `test('checkpoint then close: the closed record wins and a later checkpoint is ignored')`.
- `test('an abandoned run is saved incomplete with its activeMs and no stars')`.
- `test('a run with nothing played is not saved')`: `hasPlayableContent` is false for a fresh snapshot.
- `test('attemptFrom records only reached targets')`.

`repairs.test.ts`:
- `test('repairStreak writes the records and lowers the balance by the cost')`.
- `test('repairStreak refuses when there is no offer or not enough notes, and writes nothing')`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/store`. Expected: FAIL.
- [ ] **Step 3: Implement the store modules and the hook.** The hook is exercised end to end in Task 11.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/store && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat: save runs, checkpoint on sleep, update hints once, pay for repairs"`.

---

### Task 10: Backup export and import

**Files:**
- Create: `src/store/backup.ts`
- Test: `src/store/backup.test.ts`

**Interfaces:**
- Produces:
  - `BACKUP_FORMAT = 'violin-trainer-backup'`;
  - `interface BackupFile { format: typeof BACKUP_FORMAT; schemaVersion: number; exportedAt: number; tables: Record<TableName, unknown[]> }`;
  - `exportBackup(db, now: number): Promise<BackupFile>`: every table, including soft-deleted rows. It sets `Settings.lastBackupAt = now`, and the exported settings already carry that value.
  - `backupFileName(now: number): string`, e.g. `violin-trainer-backup-2026-11-26.json`;
  - `type BackupProblem = 'notJson' | 'notABackup' | 'newerVersion'`;
  - `parseBackup(text: string): { ok: true; backup: BackupFile; profiles: number; attempts: number } | { ok: false; problem: BackupProblem }`. The `profiles` count leaves out deleted profiles. It rejects:
    - a missing or wrong `format`;
    - a missing table;
    - a table that isn't an array;
    - `schemaVersion > SCHEMA_VERSION`, as `newerVersion`.
  - `replaceWithBackup(db, backup: BackupFile): Promise<void>`: one transaction over all tables that clears each one and `bulkAdd`s its rows. Any error rolls the whole thing back.
- The UI (Task 11) downloads `exportBackup` of the current data before calling `replaceWithBackup`, after a confirmation naming the counts (§4.4).

- [ ] **Step 1: Write the failing tests**
- `test('round trip: export then import into an empty database gives identical tables')`.
- `test('soft-deleted rows are included')`.
- `test('export sets lastBackupAt')`.
- `test.each([['not json', '{'], ['other app', '{"format":"x"}'], ['missing table', …], ['newer version', …]])('parseBackup refuses %s')`, with the matching `problem`.
- `test('a failing import leaves the current data untouched')`: the backup has two attempts with the same id, so `bulkAdd` throws; the original rows are still there.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat: full backup export and safe import"`.

---

### Task 11: App shell, profile picker, settings, path and practice wiring

This is the task where the app changes for the user. It replaces `ExercisePicker`.

**Files:**
- Create:
  - `src/ui/DbProvider.tsx`: the database context plus `useDb()` and `storageAvailable`;
  - `src/ui/ProfilePicker.tsx`
  - `src/ui/SettingsScreen.tsx`
  - `src/ui/PathScreen.tsx`
  - `src/ui/Celebration.tsx`
  - `src/ui/TryAbcScreen.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`, `src/ui/PracticeScreen.tsx`, `src/i18n/messages/*`, `src/index.css`
- Delete: `src/ui/ExercisePicker.tsx`
- Test: `e2e/practice.spec.ts`, `e2e/i18n.spec.ts` (updated), `e2e/helpers.ts`, `e2e/progress.spec.ts` (new)

**Interfaces:**
- **Startup** (`main.tsx`):
  1. `openDatabase()` and `db.open()`.
  2. If opening fails (IndexedDB unavailable), dynamically import `fake-indexeddb` and open an in-memory database instead, setting `storageAvailable = false`. A banner then says progress won't be saved in this window (v1 §10).
  3. `syncBuiltinUnits(db, Date.now())`.
  4. Fire-and-forget `requestPersistentStorage()`.
  5. Render inside `I18nProvider` and `DbProvider`.
- **`App.tsx` screen state:**
  ```ts
  type Screen =
    | { name: 'picker' }
    | { name: 'path'; profileId: string }
    | { name: 'tuning'; profileId: string; exerciseId: string } // Task 13
    | { name: 'practice'; profileId: string; exerciseId: string }
    | { name: 'leaderboard'; from: Screen } // Task 12
    | { name: 'settings' }
    | { name: 'tryAbc' }
  ```
  - Choosing a profile calls `setLocale(profile.locale)`, so the picker keeps showing the last profile's language through the existing `localStorage` choice (§9). The path's language menu calls `setLocale` and `updateProfile(…, { locale })`.
  - Starting an exercise goes to `tuning` unless `profile.skipTuning`. Until Task 13, it goes straight to `practice`.
- **`ProfilePicker`:**
  - one card per profile showing avatar, name, easy streak and practice streak;
  - links to the leaderboard (Task 12) and to settings;
  - empty state: "Add the first player", which opens settings;
  - a backup-reminder slot (Task 14).
- **`SettingsScreen`** (§7.6):
  - **Profiles:** add, rename, avatar choice, delete. Delete needs a confirm button inside the page, not `window.confirm`.
  - **Per profile:**
    - goal, as a select of 5..60 step 5, calling `setGoal` with today;
    - green and yellow cents, validated with `validateTolerances` and its translated `toleranceProblems`;
    - skip tuning.
  - **A4:** a number input from 415 to 466.
  - **Backup:**
    - **Export:** downloads `backupFileName` as JSON through an object URL.
    - **Import:** a file input. It shows `parseBackup` problems, or a confirmation with the counts; on confirm, it downloads the current backup, then calls `replaceWithBackup`.
  - **Other:**
    - a persistence-status line;
    - a "Try ABC" link to `TryAbcScreen`.
- **`TryAbcScreen`:** the Plan 1 "Your own ABC" box and preview, moved from `ExercisePicker` unchanged. Its runs are practice-only, with nothing saved; it passes no recorder.
- **`PathScreen`** (§7.3):
  - **Header:** the name and the language menu.
  - **Goal ring:** today's minutes out of the goal, with an SVG ring.
  - **Streaks:** both streaks, the week's dots from `weeklyLeaderboard`'s `week` row for this profile, and the notes balance.
  - **Repair offers**, from `repairOffers`. Tap opens a confirmation inside the page, then calls `repairStreak`. If notes are short, show how many are missing.
  - **Units:** the units with exercises showing title (translated via `sampleIdOf` / `unitKeyOf`, otherwise the stored title), best stars and lock state.
  - **Scroll:** scrolled to `nextToPlay` on open.
  - **Empty path:** a friendly message.
- **`PracticeScreen` changes:**
  - **New props:** `{ profileId: string; exerciseId: string; title: string; config: SessionConfig; todayActiveMsBefore: number; goalMs: number; onExit: () => void }`.
  - **Config** is built in `App` from the profile's tolerances, `Settings.a4Hz` and `initialHintFor(hintCounts(...))`.
  - **Recording:** it calls `useRunRecorder`. To share the snapshot, `usePractice`'s return already exposes `snapshot`.
  - **Banner during a run:** shown once when `goalJustReached(todayActiveMsBefore, snapshot.activeMs, goalMs)`.
  - **Summary:**
    - adds today's minutes against the goal and both streaks, computed from the history after the run;
    - shows `celebrationsFor(before, after)` through `Celebration`;
    - adds a "Back to path" button next to "Play again".
- **`Celebration`:** a short overlay, dismissed by a tap or after 4 s, with no motion under `prefers-reduced-motion`.
- **Messages:** add groups `profiles`, `path`, `settings`, `backup`, `storage`, `streaks`, `notes`, `celebrations` to `Messages`, in both languages.
  - Counts use `f.plural`, as the existing `count` helper does.
  - Avatars need translated labels for screen readers.

**`e2e/helpers.ts`:** `addProfile(page, name: string)` goes to `/`, adds a profile through settings, returns to the picker and opens that profile's path.

- [ ] **Step 1: Update the e2e tests so they fail**
  - **`practice.spec.ts`:** each test first calls `addProfile(page, 'Player A')`, then clicks "Open strings" on the path. The existing assertions stay. The "leaving mid-exercise" test leaves with the path's back button.
  - **`i18n.spec.ts`:**
    - adapt the first test: switch language on the path, reload, and the picker and path show Portuguese;
    - the ABC test moves to Try ABC through settings.
  - **New `e2e/progress.spec.ts`:**
    - `test('first visit shows the empty picker and adding a player opens their path')`.
    - `test('a finished run saves stars, unlocks the next exercise and survives a reload')`:
      - play Open strings, which gives 2 stars;
      - "Back to path" shows ★★☆ on Open strings and "A string: fingers 0 to 3" unlocked;
      - after `page.reload()`, choosing the profile again shows the same;
      - today's minutes on the path is above 0.
    - `test('leaving mid-run still counts minutes')`.
    - `test('settings: goal and tolerances are saved per profile')`.
    - `test('backup export downloads a file, and importing it back restores the data')`: use `page.waitForEvent('download')` and `setInputFiles`.
- [ ] **Step 2: Run the e2e tests and confirm they fail.** Run: `npm run e2e`. Expected: FAIL.
- [ ] **Step 3: Implement the screens, routing and messages.** Delete `ExercisePicker.tsx`.
- [ ] **Step 4: Run every quality gate.** Run: `npm run typecheck && npm test && npm run e2e`. Expected: all PASS.
- [ ] **Step 5: Check by hand** with `npm run dev`:
  - at 1280×800 and 1440×900, the picker, path and summary are usable, and the tap targets are at least 48 px;
  - there is no horizontal scroll in portrait at 800×1280.
- [ ] **Step 6: Commit** with `git commit -m "feat: profiles, learning path, saved progress, streaks and goal on screen"`.

---

### Task 12: Leaderboard screen

**Files:**
- Create: `src/ui/LeaderboardScreen.tsx`
- Modify: `src/App.tsx`, `src/i18n/messages/*`, `src/index.css`
- Test: `e2e/progress.spec.ts`

**Interfaces:**
- Consumes `weeklyLeaderboard`, `streaks`, `loadHistory` and `listProfiles`.
- Shows, per row: place, avatar, name, goal-day dots (●/○ for Monday to Sunday) and both streaks.
- Never shows stars or accuracy (§6.4).
- Reached from the picker and the path; its back button returns to `from`.
- [ ] **Step 1: Write the failing e2e test**: `test('leaderboard lists every player with goal-day dots and no stars')`.
  - Create two profiles and play one run with the first.
  - Both rows are visible.
  - The row has no `★` character.
- [ ] **Step 2: Run it and confirm it fails.** Run: `npx playwright test e2e/progress.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run every quality gate.** Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat: weekly family leaderboard ranked by goal days"`.

---

### Task 13: Tuning screen

**Files:**
- Create: `src/practice/tuning.ts`, `src/ui/useTuner.ts`, `src/ui/TuningScreen.tsx`
- Modify: `src/App.tsx`, `src/i18n/messages/*`, `src/index.css`
- Test: `src/practice/tuning.test.ts`, `e2e/progress.spec.ts`

**Interfaces:**
- Produces, in `tuning.ts`:
  - `OPEN_STRING_MIDI = [55, 62, 69, 76] as const`;
  - `TUNING_GREEN_CENTS = 5`;
  - `nearestOpenString(hz: number, a4Hz: number): { midi: number; cents: number }`.
- Produces, in `useTuner.ts`: `useTuner(a4Hz: number): { status: PracticeStatus; error: MicrophoneError | null; reading: { midi: number; cents: number } | null; start(): void }`.
  - It reuses `startMicrophone`, `createFrameAnalyzer(FRAME_SIZE, HOP_SIZE)` and `PitchSmoother(100)`.
  - A frame counts only when `isPitched(frame)` (from `src/analysis/level.ts`).
  - It releases the microphone on unmount, as `PracticeRunner` does.
- **`TuningScreen`:**
  - shows the four strings, highlighting the nearest one;
  - shows a cents needle, green within ±5;
  - has a "Skip" button and a "Don't show before practice" checkbox, which calls `updateProfile(…, { skipTuning: true })`;
  - has a "Ready" button that goes to `practice`.
  - Nothing is judged or saved (§7.4).
- [ ] **Step 1: Write the failing tests**:
  - `tuning.test.ts`:
    - 440 Hz gives `{ midi: 69, cents: ≈0 }`;
    - 196 × 2^(10/1200) gives `{ midi: 55, cents: ≈10 }`;
    - 300 Hz is nearest to D4 (62);
    - with A4 = 442, 442 Hz gives 0 cents.
  - e2e: `test('tuning screen appears before practice and can be skipped for next time')`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Replace Task 11's temporary direct-to-practice route.
- [ ] **Step 4: Run every quality gate.** Expected: PASS. The e2e tests in `practice.spec.ts` must click "Skip" or set `skipTuning` through the helper; update `addProfile` to accept `{ skipTuning?: boolean }`, defaulting to true.
- [ ] **Step 5: Commit** with `git commit -m "feat: tuning screen before practice"`.

---

### Task 14: Installable app and backup reminder

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `scripts/make-icons.ts`, `src/ui/BackupReminder.tsx`
- Modify: `index.html`, `src/ui/ProfilePicker.tsx`, `src/ui/SettingsScreen.tsx`, `src/i18n/messages/*`
- Test: `e2e/progress.spec.ts`

**Interfaces:**
- **Manifest:**
  - `name` "Violin Trainer", `short_name` "Violin";
  - `start_url` `"./"`, `scope` `"./"`, so the app works under `/ViolinTrainer/` (§4.1);
  - `display` `"standalone"`, `orientation` `"any"`;
  - `background_color` and `theme_color` from the app's palette;
  - icons 192 and 512 PNG, `purpose: "any maskable"`.
  - `index.html` links it with `<link rel="manifest" href="/manifest.webmanifest">`, plus `<meta name="theme-color">`. Vite prefixes public URLs in `index.html` with `base`; verify this in `dist/index.html` after `BASE_PATH=/ViolinTrainer/ npm run build`.
  - No service worker (§4.1).
- **`scripts/make-icons.ts`:** writes both PNGs with only `node:zlib` and `node:fs`: a simple design, a white note on the theme colour, with no copied artwork. Run it once and commit the PNGs it makes.
- **`BackupReminder`:**
  - shown on the picker when `shouldShowBackupReminder` is true;
  - text "Last backup: never" or "…N days ago", an Export button (the same export as settings), and a dismiss button that sets `backupReminderDismissedAt`;
  - it never covers the profile cards.
- **Settings** shows the persistence status: "This browser keeps the data" / "This browser may clear the data: install the app or export backups often".

- [ ] **Step 1: Write the failing e2e tests**:
  - `test('the manifest is served and linked')`: fetch the linked manifest URL; it has status 200 and `display === 'standalone'`.
  - `test('backup reminder appears after a run with no backup, and dismissing hides it')`.
- [ ] **Step 2: Run them and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement. Run `node scripts/make-icons.ts` and commit its output.**
- [ ] **Step 4: Run every quality gate, plus the base-path check.** Run: `npm run typecheck && npm test && npm run e2e && BASE_PATH=/ViolinTrainer/ npm run build && grep manifest dist/index.html`.

  Expected: PASS, and the grep shows `href="/ViolinTrainer/manifest.webmanifest"`.

  Then, in Chrome on the desktop with `npx vite preview`, DevTools → Application → Manifest shows no installability errors.
- [ ] **Step 5: Commit** with `git commit -m "feat: installable app and backup reminder"`.

---

### Task 15: Documentation and wrap-up

**Files:**
- Modify: `README.md` (status; profiles, path, streaks, backup; how to install on Android), `AGENTS.md` (architecture: add `src/store` and `src/progress`)

- [ ] **Step 1: Update the docs.**
  - README status: profiles, a learning path, streaks and backups work; the parent area and editor come next.
  - Add a short "Install on a tablet" paragraph: open the address in Chrome, then menu → Install app / Add to home screen.
  - Remind readers that data stays in the browser, and to export backups.
- [ ] **Step 2: Run every quality gate.** Run: `npm run typecheck && npm test && npm run build && npm run e2e`. Expected: all PASS.
- [ ] **Step 3: Commit** with `git commit -m "docs: Plan 2a features, installing on a tablet"`.
- [ ] **Step 4: Open the PR.** Its description lists the manual checks (per the project's beads memory "pr-manual-testing"):
  - On the Android tablet:
    - install the app;
    - choose a profile;
    - play a built-in exercise with a real violin;
    - check the goal ring, streaks and summary, and that tapping is easy held sideways.
  - Close the app mid-run; reopen it, and the minutes are kept.
  - Play the three tunes written in Task 8 (*O Come, Little Children*, *May Song*, *Long, Long Ago*) and confirm the melodies by ear.
  - Read every new screen in English and Portuguese.
  - Export a backup on the tablet and import it on the laptop.
  - Settings: change the goal and tolerances, and check the path and judging follow them.

  Merge method per beads memory "merge-strategy": a merge commit, since this is a multi-commit plan.
