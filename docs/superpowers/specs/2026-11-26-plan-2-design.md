# Plan 2: Profiles, Progress and the Parent Area: Design

Date: 2026-11-26
Status: draft for review
Builds on: `2026-10-16-violin-trainer-v1-design.md` (the v1 spec). Where this document differs from it, this document wins.

## 1. Intent

Plan 1 made the core loop work: play an exercise, have every note judged. Nothing is remembered between runs, and there is no reason to come back tomorrow. Plan 2 makes the app something a family of beginners opens every day.

What keeps a young beginner practising is not known yet, so the design does not bet on one mechanism. It gives two streaks: an easy one that rewards picking up the violin at all, and a harder one that rewards real practice. Their weight can be judged from use. Ranking between people rewards effort, never skill, because the family members play at different levels.

The family follows the Suzuki method and also plays Brazilian Baptist hymns (*Cantor Cristão*, *Hinário para o Culto Cristão*). The learning path is mostly the family's own repertoire, typed in ABC by a parent. A teacher may later send exercises from home and follow progress during the week. That needs sync, which is not in Plan 2, but nothing in Plan 2 may block it.

The shared device will soon be an Android tablet (checked on an Android phone on 2026-11-26: judging works). The MacBook stays supported.

## 2. Goals, non-goals, anti-goals

**Goals**

- Profiles chosen at startup; all progress saved per profile in the browser.
- A learning path with units, stars, unlocking and fading hints, as in v1 spec §6.3 and §8.2.
- Two streaks and a daily minutes goal (§6), and a weekly family leaderboard ranked by effort.
- A tuning screen before practice.
- A parent area behind a PIN with an ABC editor that handles repeats and transposing, learning-path setup, per-profile settings, unit import/export, and a full backup.
- Data shaped so sync and accounts can be added later without migration pain (§4).

**Non-goals (later versions)**

- Sync, accounts, a teacher view or dashboard. Whether accounts will belong to a family or to each person is **deliberately undecided**; Plan 2 must suit both.
- Rhythm, metronome, play-along (v1 spec §13).
- MusicXML import; multi-voice scores.
- XP, shop, mascot. Notes (§6.7) buy streak repairs and nothing else.
- Built-in hymns. Hymns come in through the editor.

**Anti-goals (failure even if it works)**

- A child who keeps losing to adults on the leaderboard. Nothing ranks skill, accuracy or stars between people.
- A streak that one sick day wipes out.
- Losing a child's progress: the browser clearing data, a bad import, or a schema change.
- Copyrighted material shipped in the app. Suzuki's own compositions, method-book arrangements and the 1990 *Hinário* are never built in. The family may type them for private use; that data never leaves their browser except in their own backup files.
- Weakening precision (v1 spec §1). Plan 2 changes no judging rule.

## 3. Order of work

Plan 2 is built and merged in two parts, each its own implementation plan and PR. Approach B (§12).

**2a: the children's side.**
- Storage and backup, an installable app and the backup reminder (§4.1).
- Profiles: a simple, unlocked screen to add and edit them.
- Learning path from built-in units.
- Stars, unlocking, persisted hint fading.
- Both streaks, the minutes goal, the leaderboard, celebrations.
- The tuning screen.
- Per-profile goal and tolerances, also on an unlocked settings screen.

**2b: the parent area.**
- The PIN, which then locks the profile and settings screens from 2a.
- The ABC editor with repeat expansion and transposing.
- Learning-path setup, manual unlocks, unit import/export.

2a must be useful on its own: a child can practise the built-in path daily with streaks and goals before 2b exists.

## 4. Data and storage

### 4.1 Storage

- IndexedDB through Dexie, as the v1 spec decided. The database has an app-specific name, `violin-trainer`, because every GitHub Pages project under `marquezino.github.io` shares one origin.
- At startup the app calls `navigator.storage.persist()`. Chrome on Android usually refuses this for an ordinary website but grants it to an installed one, so 2a protects the data in two ways:
  - **Installable app.** A web app manifest with a name, icons, `display: standalone` and the right `start_url`/`scope` for the `/ViolinTrainer/` path, so Chrome offers "Add to home screen" or "Install". The installed app opens full screen. There is no service worker and no offline mode: those stay post-v1. The builder checks Chrome's current installability criteria on Android and on desktop.
  - **Backup reminder.** `Settings.lastBackupAt` records the last export. When at least one attempt exists and there has been no export for 14 days, or ever, the profile picker shows a small, dismissible note for the parent: "Last backup: never / N days ago", with an export button. Dismissing it hides it for 7 days. It never blocks a child from practising. The settings screen also shows whether the browser granted persistent storage.
- If IndexedDB is unavailable (private window), the app shows a startup warning (v1 spec §10).
- Schema changes go through Dexie versions with upgrade functions, tested against a database made by the previous version.

### 4.2 Rules that keep sync possible

- Every record has a random UUID id (`crypto.randomUUID()`), never an auto-increment key.
- Every record has `createdAt` and `updatedAt` (ms since epoch).
- Units, exercises and profiles are never erased. They get `deletedAt` and are hidden everywhere. The backup includes them.
- Practice results (`Attempt`) are append-only: never edited, never deleted. Best stars, unlocks, streaks, goal days and the leaderboard are computed from them, not stored.
- Settings that change over time and affect past days, such as the daily goal, are stored as dated, append-only records (`GoalSetting`), so history recomputes the same way on any device.
- Nothing depends on a server or an account.

### 4.3 Records

Changes from v1 spec §11 are marked.

- `Profile`: id, name, avatar (one of a fixed set of icons; no photos), greenCents, yellowCents, locale (new), createdAt, updatedAt, deletedAt (new).
- `GoalSetting` (new): id, profileId, minutes, fromDay (local date `YYYY-MM-DD`), createdAt. The goal for a day is the latest setting with `fromDay` on or before that day. Changing a goal applies from today on.
- `Settings`: a4Hz, parentPinHash, parentPinSalt (2b), lastProfileId (new; preselects the picker's language), lastBackupAt (new), backupReminderDismissedAt (new).
- `Unit`: id, title, order, source (new: `builtin` | `imported` | `local`), sourceVersion (new: number, for built-in and imported units), createdAt, updatedAt, deletedAt.
- `Exercise`: id, unitId, order, title, abc, transpose (new: semitones, default 0; see §8.3), createdAt, updatedAt, deletedAt.
- `Attempt`: id, profileId, exerciseId, startedAt, finishedAt, completed, points, maxPoints, stars, activeMs (new, §6.3), results (per target: targetId, color, redAttempts, centsAtAcceptance). Unfinished runs are saved too, because they count toward minutes.
- `HintState`: profileId, noteKey, consecutiveFirstTryGreens, updatedAt.
- `ManualUnlock` (2b): id, profileId, exerciseId, createdAt.
- `StreakRepair` (new, §6.7): id, profileId, streak, day, cost, createdAt. Add-only.

`targetId` is the target's index in the expanded note sequence of the exercise as it was at the time. If an exercise is later edited, old attempts keep their stars but their per-note results are not mapped onto the new notes.

### 4.4 Backup

- One JSON file containing every table, a format name and a schema version. Export is one tap on the parent settings screen. In 2a, settings are unlocked, so it is reachable there.
- Import replaces the whole database after a confirmation that names how many profiles and attempts the file holds. Before replacing, the app downloads an automatic backup of the current data. A file with a newer schema version than the app is refused.
- This is also how the data moves if the app's address changes later (for example a custom domain): export at the old address, import at the new.

## 5. Built-in content

- Built-in units ship in code and are loaded into the database through the same path as an imported unit (§8.5), with `source: 'builtin'`, fixed ids and a version number. On startup, if the code's version is newer, the built-in unit is updated in place. Ids stay the same, so progress carries over. Parents cannot edit built-in exercises; they can copy one into a local unit (2b) and hide built-in units from the path.
- 2a ships two built-in units:
  1. **First steps:** the five Plan 1 exercises.
  2. **Traditional tunes:** traditional melodies in the order beginners usually meet them in Suzuki Book 1: *Lightly Row*, *Song of the Wind*, *Go Tell Aunt Rhody*, *O Come, Little Children*, *May Song*, *Long, Long Ago*. They are written fresh for this project from the traditional melodies, in A major, with repeats written out, and are not copied from any book's arrangement. *Long, Long Ago* (T. H. Bayly, 1833) and *O Come, Little Children* (J. A. P. Schulz, 1794) are long in the public domain; the others are folk tunes.
- Built-in titles are translated, as `sampleTitles` already are.

## 6. Motivation

All days are **local calendar days**. A run belongs to the day it started. Weeks run Monday to Sunday.

There are two streaks. Each has its own kind of counting day (§6.1, §6.2), but both use the same rule for gaps:

- **The gap rule:** up to **two missed days in a row** are forgiven. A third consecutive missed day breaks the streak. A day repaired with notes (§6.7) is not a missed day.
- **Counting back from today** (builder's question, settled by Claude):
  - Start at today and walk back one day at a time, as long as the stretch still obeys the gap rule. The streak is that stretch.
  - It always begins on a counting day, and the number shown is how many counting days it contains, not calendar days. Repaired days don't add to it.
  - Today counts if it already qualifies. Otherwise it is skipped, not missed, so in the morning the streak shown is yesterday's.
  - A break therefore never erases the days practised after it.
- **Example, today Friday:** Mon ✓, Tue ✗, Wed ✗, Thu ✗, Fri ✓. Thursday is the third miss in a row, so the stretch is Friday alone and the streak is **1**. With Wednesday practised instead, the stretch would reach back to Monday and the streak would count 3.
- **The easy streak is never shorter than the practice streak.** Every goal day is also a practice day, and both streaks share the gap rule. A practice-streak repair also repairs the easy streak (§6.7), so repairs keep this true. Tests must check it as a property.

### 6.1 Easy streak: "picked up the violin"

A **practice day** has at least one completed run, or is a goal day.

### 6.2 Practice streak: "real practice"

A **goal day** is one where the profile's active minutes reach that day's goal.

### 6.3 Active minutes

- `activeMs` of a run is the time from start to end, minus every stretch of 30 s or more without a note event. Both accepted and rejected note events count. Retries and unfinished runs count.
- A run ends when it is finished, exited or abandoned, for example when the app is closed or the tablet sleeps. An abandoned run is saved with what was measured up to the last note event, so nothing is lost when a child just walks away.
- Default goal: 10 minutes. Range 5 to 60 in steps of 5. Set per profile.

### 6.4 Weekly leaderboard

- Ranks all profiles by goal days this week. Ties are broken by completed runs this week, and remaining ties share a place.
- Shows each person's goal days as dots (●●○●●○○) and both streaks.
- Stars and accuracy never appear on it.

### 6.5 Stars and unlocking

As in v1 spec §8.2: best stars per exercise are kept, and the next exercise unlocks at 2 stars or more. Order runs through the path: the first exercise of a unit unlocks when the last exercise of the previous unit has 2 stars. The first exercise of the first visible unit is always unlocked. In 2b a parent can unlock any exercise for a profile.

**Nothing ever locks again** (builder's question, settled by Claude). An exercise is unlocked for a profile if any of these hold:
- the profile has any attempt on it;
- it has a manual unlock;
- the rule above unlocks it.

So reordering, hiding and showing units, a built-in upgrade or an imported update never takes away an exercise a child has already played.

### 6.6 Celebrations

Short, joyful and skippable. They appear when the daily goal is reached (shown when it happens, in the middle of a run or at the summary), when either streak reaches 7, 30, 100 or 365, and on new best stars. Animations respect `prefers-reduced-motion`. No sound effects in Plan 2.

### 6.7 Notes (♪) and streak repairs

**Notes** are a small currency per profile. They are separate from run points, and their only use is repairing a broken streak. There is no shop.

**Earning:** effort only, so it is fair across levels.
- **5 ♪** per goal day.
- **1 ♪** per new star on an exercise, counted when a profile's best stars on it rise: going from 1 to 3 stars gives 2 ♪.

Earnings are computed from attempts and goal settings, never stored. They therefore come out the same on any device.

**Repairing:**
- **When it is offered:** only on the day right after a streak broke, meaning yesterday was its third missed day in a row. The path shows the broken streak's old number with "Repair for N ♪", where N is the cost below.
- **What it does:** yesterday becomes a repaired day, so the old stretch joins today's again. A repaired day is not counted as practised.
- **Easy streak:** **20 ♪**, and it repairs only the easy streak.
- **Practice streak:** **40 ♪**. It repairs the practice streak and, unless that day was already a practice day, also marks it repaired for the easy streak at no extra cost. Otherwise a practice repair could leave the easy streak shorter than the practice streak.
- **Not enough notes:** the offer shows how many are missing.
- **After the day passes:** the offer disappears.
- **Undoing:** a repair can't be undone.

**Stored as `StreakRepair`:** id, profileId, streak (`easy` | `practice`), day (the repaired day, `YYYY-MM-DD`), cost, createdAt. These records are add-only. The balance is computed: notes earned minus the sum of `cost`. A repair is accepted only while the balance covers it.

**Leaderboard:** a repaired day is not a goal day, so notes can't buy a better place (§6.4).

## 7. Screens (2a)

Children's screens are designed first for a tablet held sideways, with large tap targets. They also work on the laptop and in portrait. The parent area may be laptop-first.

### 7.1 Flow

Profile picker → path → (tuning, optional → room check → practice → summary) → path. The leaderboard is reachable from the picker and the path.

### 7.2 Profile picker

```
  Who's practising?                                 [🏆 This week]
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │   🎻     │  │   🎵     │  │   🎼     │      [⚙ Settings]
  │  Name    │  │  Name    │  │  Name    │
  │ 🔥12 ⭐5 │  │ 🔥3 ⭐3  │  │ 🔥40 ⭐9 │
  └──────────┘  └──────────┘  └──────────┘
```

Each card shows both streaks: the easy one and the practice one. Icons are placeholders; the builder chooses symbols that read clearly in both languages. Empty state: "Add the first player".

### 7.3 Path

- The profile's name and the language menu at the top. The language is saved on the profile.
- Today's goal ring, showing minutes done out of the goal, both streaks, this week's goal-day dots, and the notes balance. A repair offer (§6.7) appears here on the day after a break.
- Units in order, each with its exercises: title, best stars, and locked/unlocked. Tapping an unlocked exercise starts it.
- After a run, the path opens scrolled to the next exercise to play.

### 7.4 Tuning screen

Offered before practice and skippable, with a "skip next time" option per profile. It shows the four open strings. The needle shows the cents deviation from the string being tuned, picked automatically as the nearest open string, with green inside ±5 cents. It is a helper only; nothing is judged or saved. It uses the same microphone pipeline and A4 setting.

### 7.5 Summary

As in Plan 1. Added: minutes today versus the goal, streak changes, and any celebration.

### 7.6 Settings (unlocked in 2a, behind the PIN in 2b)

- Profiles: add, rename, choose avatar, delete (soft).
- Per profile: daily goal, green/yellow tolerances, "skip tuning".
- A4 reference.
- Export backup, import backup.
- The storage-persistence notice (§4.1).

## 8. Parent area (2b)

### 8.1 PIN

Set on first entry to the parent area. A 4 to 6 digit PIN, stored as a salted hash (v1 spec §8.1). It is a lock against children, not security. If it is forgotten, a reset clears only the PIN after a typed confirmation sentence; no data is lost. All of §7.6 moves behind it.

### 8.2 Editor

- The Plan 1 ABC textarea with a live preview grows into a full editor: title, ABC text, preview, the error and warning list, and the cheat sheet of first-position notes (v1 spec §3.1). An exercise with errors cannot be saved.
- Laptop-first; it must still be usable on the tablet with a keyboard.

### 8.3 Repeats and transposing

- **Repeats:** `|:`, `:|`, `::` and first/second endings (`[1`, `[2`) are no longer errors. The exercise is expanded into the note sequence as played. Targets follow that sequence, and the score shows the expanded music, written out, so the cursor never jumps backwards. *D.C.*, *D.S.*, *Fine*, coda signs, and endings beyond 2 remain errors with a clear message.
- **Transposing:** buttons move the exercise up or down by a semitone, with the resulting key shown. Range warnings and errors (v1 spec §7) apply to the transposed notes. Whether the transposition is stored as `transpose` or by rewriting the ABC text is the builder's call; the user-facing rule is that the saved exercise plays in the shown key.

### 8.4 Learning-path setup

- Create, rename, reorder and hide units.
- Add, edit, reorder and move exercises between units.
- Copy a built-in exercise into a local unit.
- Manual unlock per profile.
- Reordering by up/down buttons is enough; drag and drop is optional.

### 8.5 Unit import/export

- Export a unit as a single `.abc` file holding several tunes. The unit's title, id and version, and each exercise's id, are kept in comment directives the app reads back, for example `%%vt-unit`, `%%vt-id`. Other ABC tools still open it as an ordinary multi-tune file.
- Import: a new unit id creates a unit with `source: 'imported'`. A known id with a newer version updates the unit in place: changed exercises update, new ones are added, removed ones get `deletedAt`. Progress carries over by exercise id. If the parent had edited an imported exercise, the newer imported version wins, and the import screen says which exercises will be replaced before confirming.
- Importing a single-tune `.abc` file creates one exercise in a chosen unit (v1 spec §3.1).

## 9. Language

All new text goes into the message files in English and Brazilian Portuguese from the start (i18n spec). The language becomes a profile setting: switching on the path saves it to the profile. The profile picker uses the language of the last profile used, falling back to the current `localStorage` choice, which is migrated once and then stops being read.

## 10. Testing

- **Pure logic, Vitest:**
  - streaks with forgiven and breaking gaps across month ends and daylight-saving changes;
  - repairs, including the easy-streak repair that a practice repair includes;
  - the notes balance;
  - the property "easy streak ≥ practice streak" under random histories with repairs (fast-check);
  - active minutes with gaps around the 30 s line;
  - goal history;
  - leaderboard ties;
  - unlocking across units, built-in version upgrades, unit import updates and soft deletes;
  - repeat expansion and transposing (2b).
- **Storage with `fake-indexeddb`:** schema upgrade from each previous version; backup round trip (export then import gives identical data); refusal of a newer schema.
- **End-to-end (Playwright, fake microphone):** create a profile, play an exercise, see stars and goal minutes on the path, unlock the next exercise, reload and see everything kept. In 2b: PIN, editor save, a repeat exercise played through.
- **By hand, in each PR description:**
  - on the tablet: the picker, path and celebrations;
  - with a real violin: a full run;
  - reading every new text in both languages;
  - for 2b: typing a real hymn with repeats.

## 11. What's left to the builder

- Visual design of cards, the goal ring, celebrations and the icon set, within §7.
- How the tuning screen picks and holds a string.
- How transposition is stored (§8.3).
- Exact wording, in both languages.
- Splitting 2a and 2b into implementation tasks.

## 12. Approaches considered

- **A. One plan, one PR.** Simplest to plan, but the longest wait before the child sees anything, and the hardest PR to test by hand.
- **B. The children's side first, then the parent area (chosen).** It addresses the urgent problem, motivation, first. The built-in traditional tunes give a real path before the editor exists. Cost: until 2b, settings are unlocked and the path can't be customised.
- **C. The parent area first.** It would let the family type their Suzuki and hymn repertoire sooner, but it delays the motivation features that are needed now.

## 13. Decisions recorded in this conversation

- No teacher role or screen in Plan 2. Unit export/import is the teacher's channel until sync.
- One shared device; the tablet will be used soon.
- Two streaks with the same gap rule: up to two missed days in a row are forgiven. Each counts the days actually practised. A goal day is also a practice day, so the easy streak is never shorter than the practice streak. (An earlier "one missed day per week" rule for the easy streak was replaced because it could make the practice streak the longer one.)
- A broken streak can be repaired on the next day with notes earned by effort: 20 ♪ for the easy streak, 40 ♪ for the practice streak (which also repairs the easy one). Earning: 5 ♪ per goal day, 1 ♪ per new star.
- The daily goal is measured in active minutes, set per profile.
- The leaderboard ranks by goal days, with ties broken by completed runs. Stars are never compared between people.
- Per-profile tolerances and goals act as the handicap between levels.
- The address stays `marquezino.github.io/ViolinTrainer` for now; the backup file is the migration path.
- 2a makes the app installable (no offline mode) and adds a backup reminder on the profile picker, to protect progress on Android.
