# Violin Trainer v1: Design

Date: 2026-10-16
Status: draft for review

## 1. Purpose and users

A practice app for a family of beginner violinists, adults and children. A teacher may later assign exercises, and other students may use it. A public product is possible in the future but does not drive v1.

Priorities, in order:

1. **Precision is a hard requirement.** The app must never teach a mistake. A wrong note marked as correct is worse than no practice at all. When the analysis is unsure, the app gives no credit.
2. **Motivation and consistency.** The app should make a child want to practice. Duolingo-style progress is a familiar model for children.
3. **Reading.** Connect the note on the staff to its string and finger.

## 2. Decisions

| Topic | Decision |
|---|---|
| Platform | Web app, TypeScript. Chrome and Firefox on macOS are supported. Android is not tested in v1, but nothing may rule it out. |
| Score format | ABC notation, typed in the app's own editor with a live preview. MusicXML import is a later feature (via xml2abc). |
| Score rendering | abcjs (SVG, one element per note). |
| UI | React + Vite. |
| Pitch detection | Pitchy (McLeod Pitch Method), behind an interface so it can be replaced if the precision targets are not met. |
| Storage | IndexedDB through Dexie, local only. Every record has a stable id and timestamps so that sync can be added later. |
| Analysis core language | TypeScript only. No Rust/WebAssembly. |
| Exercise mode in v1 | Wait mode (pitch only). Rhythm is not evaluated in v1. |
| Tuning reference | A4 = 440 Hz by default; can be changed in settings. |

## 3. Scope

### 3.1 In v1

- Profiles (name, avatar) chosen at startup.
- A parent PIN that protects tolerances, the exercise editor, the learning path, profile management, and import/export.
- An ABC exercise editor with live preview, error messages and a cheat sheet for first-position notes.
- A learning path: units containing ordered exercises, with progress kept for each profile.
- A tuning screen for the open strings before practice.
- A microphone check (noise level) before practice.
- Wait-mode practice: cursor, live tuning needle, green/yellow/red note coloring, fading string and finger hints.
- A summary after each run: stars, the colored score, and the notes to work on.
- A weekly family leaderboard and a streak for each profile.
- Import and export of exercises as `.abc` files; export and import of all data as a single backup file.

### 3.2 Not in v1

Metronome, play-along and rhythm evaluation; dynamics and articulation; MusicXML import; PDF/image input (OMR); accounts and sync; a teacher dashboard; looping and slowing down passages; double stops; PWA installation and offline support; mascot, shop, XP.

### 3.3 Success criteria

1. Precision thresholds in section 9.3 are met on the recordings suite.
2. A correctly played, in-tune note is accepted within a median of 150 ms after it becomes stable.
3. A child can choose their profile and complete an exercise without help.
4. An adult can type a beginner exercise in about 2 minutes.

## 4. Architecture

```
Microphone
  -> audio/input        getUserMedia without browser processing; high-pass filter (~150 Hz)
  -> AudioWorklet       frames posted off the main thread
  -> analysis/pitch     frame -> { frequencyHz, clarity, rmsDb }
  -> analysis/notes     frame stream -> note events (stability window, re-attack detection)
  -> practice/session   pure state machine: targets + note events + settings -> state + events
  -> ui                 score view (abcjs), cursor, tuning needle, hints, summary
```

Rule: every decision is made in pure functions (`score`, `music`, `analysis`, `practice`, `progress`). The UI only renders the state they produce. Audio and the DOM stay at the edges.

### 4.1 Units

| Unit | Responsibility | Depends on |
|---|---|---|
| `audio/input` | Open the microphone with `autoGainControl`, `noiseSuppression` and `echoCancellation` set to `false`; apply a high-pass filter; run the AudioWorklet. | Web Audio |
| `analysis/pitch` | Pitch, clarity and level for one frame. Pure function over a `Float32Array`. | Pitchy |
| `analysis/notes` | Turn a stream of frame results into note events. Pure and stateful (reducer). | `analysis/pitch` output |
| `score/abc` | Parse ABC into an `Exercise` model: ordered targets with id, MIDI pitch, duration, optional finger override, and a reference to the rendered element. | abcjs |
| `music/pitch` | Cents conversion, note naming (spelled according to the key signature), classification against tolerances. | none |
| `music/fingering` | First-position string and finger for a pitch, with overrides. | none |
| `practice/session` | Wait-mode state machine. | `music/*` |
| `practice/scoring` | Points and stars for a finished run. | none |
| `progress/*` | Unlocking, hint fading, streaks, weekly leaderboard. Pure functions over stored records. | none |
| `store` | Dexie database, schema versions, backup export/import. | Dexie |
| `ui` | React screens and components. | everything above |

## 5. Note detection

Initial parameter values. All of them are configuration constants, tuned against the recordings suite.

- Frame size 2048 samples, hop 512 samples (about 10.7 ms at 48 kHz).
- A frame is **voiced** when clarity ≥ 0.90 and its level is at least 12 dB above the noise floor measured by the microphone check.
- A **note event** starts when voiced frames stay within ±25 cents of their running median for at least **120 ms**. Its pitch is the median over that window.
- A new note event requires either:
  - a pitch move beyond the stability band (a new pitch, for example in a slur or when the player corrects intonation), or
  - a **re-attack**: the level drops at least 6 dB below the sustained level, or the frames become unvoiced, for at least 30 ms, and then rises again.
- Each note event is judged once by the session.

## 6. Wait-mode rules

### 6.1 Classification

For the current target, compute `cents = 1200 * log2(f_note / f_target)`, where `f_target` comes from equal temperament with the configured A4.

| Condition | Result | Cursor |
|---|---|---|
| `abs(cents) <= green` | green | advances |
| `green < abs(cents) <= yellow` | yellow | advances |
| nearest semitone is the target, `abs(cents) > yellow` | red, "out of tune" | stays |
| nearest semitone is another note | red, "wrong note" (the played note is named) | stays |

Default tolerances: green 20 cents, yellow 35 cents. Each profile has its own values, changeable only in parent settings.

A target accepted after at least one red attempt is shown with its color and a red marker. It earns at most the points of a yellow note.

### 6.2 Tuning needle

- Shows the cents deviation of the current sound from the current target, smoothed over about 100 ms.
- When the sound is more than 50 cents from the target, the needle shows the name of the note being played instead.
- Hidden when no frame is voiced.

### 6.3 Fading hints

- A hint shows the string and finger above the note, for example `A 2`, with a low or high mark for a low 1 or a low/high 2.
- Hint state is stored per profile and per note key (MIDI pitch + string + finger), not per exercise.
- A **first-try green** is a target accepted as green with no red attempt before it.
- A note key is **learned** after 5 first-try greens in a row on it, across any exercises. Hints for learned keys are hidden. A yellow acceptance neither counts nor resets.
- A red attempt on a target shows its hint immediately and resets that key's counter.
- If the current target is not accepted within 5 seconds, its hint appears for that target.

## 7. Fingering (first position, standard tuning G3 D4 A4 E5)

| String | 0 | 1 (low / normal) | 2 (low / high) | 3 | 4 |
|---|---|---|---|---|---|
| G | G3 | A♭3 / A3 | B♭3 / B3 | C4 | D4 |
| D | D4 | E♭4 / E4 | F4 / F♯4 | G4 | A4 |
| A | A4 | B♭4 / B4 | C5 / C♯5 | D5 | E5 |
| E | E5 | F5 / F♯5 | G5 / G♯5 | A5 | B5 |

- Range: G3 to B5. Notes outside it trigger an editor warning and show no hint.
- Default for notes reachable two ways (D4, A4, E5): the open string.
- Override with an ABC finger decoration (`!0!` to `!4!`). Pitch plus finger determines the string. A combination that does not exist in first position is an editor error.

## 8. Motivation and flow

### 8.1 Screens

Profile picker → learning path → (tuning screen → microphone check → practice → summary) → learning path.

The parent area, behind the PIN, contains the editor, the learning path setup, profiles, tolerances, A4 reference, and import/export. The PIN is a lock against children changing settings, not a security measure. It is stored as a salted hash.

### 8.2 Stars and unlocking

- Points per target: green 2; yellow 1; accepted after a red attempt at most 1.
- Percentage = points / (2 × number of targets).
- 3 stars: ≥ 90%. 2 stars: ≥ 70%. 1 star: completed below 70%.
- An unfinished run earns no stars.
- The best result per profile and exercise is kept.
- The next exercise unlocks at 2 stars or more. A parent can unlock exercises manually for any profile.

### 8.3 Leaderboard and streaks

- A **practice day** is a local calendar day with at least one completed run.
- The weekly leaderboard (Monday to Sunday, local time) ranks profiles by practice days this week, with stars earned this week as the tie-breaker.
- Each profile shows its current streak of consecutive practice days.

## 9. Testing

### 9.1 Fast suite (every change, Vitest)

- Pure logic: cents, classification, note naming, fingering table and overrides, ABC to exercise model, session state machine, scoring, unlocking, hint fading, streaks, leaderboard weeks.
- Storage with `fake-indexeddb`.
- Property-based tests with fast-check for the precision rules:
  - a pitch outside the yellow tolerance is never green or yellow;
  - a different semitone is never accepted;
  - an octave error is never accepted.

### 9.2 Synthetic audio suite (every change)

Generated signals pass through the real `analysis/pitch` and `analysis/notes` code offline:

- sine and harmonic (violin-like) tones over the full range G3 to B5;
- known detuning;
- slides;
- repeated notes with and without a dip between them;
- low-frequency rumble (traffic) and broadband noise.

The expected results are exact.

### 9.3 Recordings suite (before each release)

- Short passages recorded by the family, including deliberate mistakes: wrong notes, out-of-tune notes, repeated notes, slides.
- Annotated semi-automatically, then checked by hand.
- Thresholds:
  - wrong notes accepted: **0**;
  - out-of-tune notes judged green, counting only notes more than 5 cents beyond the green tolerance: **≤ 2%**;
  - in-tune notes not accepted within 500 ms: **≤ 5%**;
  - median time to acceptance after stability: **≤ 150 ms**.
- **Recordings are never committed.** Audio files live in `test-data/recordings/` (ignored by git). Annotation files in `test-data/labels/` are committed. The suite skips when the recordings are missing.

### 9.4 End-to-end

Playwright in Chrome with `--use-fake-device-for-media-stream` and `--use-file-for-fake-audio-capture` feeds WAV files as microphone input and checks note colors. Firefox and Android are checked by hand before each release.

## 10. Error handling

| Situation | Behavior |
|---|---|
| Microphone permission denied or no device | A screen explaining how to allow access. Practice is unavailable. |
| Noise floor too high (initial limit −50 dBFS after the high-pass filter) | Practice is blocked, with an explanation. No degraded mode. |
| Audio context not started | Practice starts with a "Start" button (browsers require a user gesture). |
| Invalid ABC, or an impossible fingering override | Error shown in the editor; the exercise cannot be saved. |
| Note outside first position | Warning in the editor; no hint for that note. |
| IndexedDB unavailable (private window) | Warning on startup; reminder to export a backup. |

## 11. Data model

- `Profile`: id, name, avatar, greenCents, yellowCents, createdAt, updatedAt.
- `Settings`: a4Hz, parentPinHash, parentPinSalt.
- `Unit`: id, title, order, createdAt, updatedAt.
- `Exercise`: id, unitId, order, title, abc, createdAt, updatedAt.
- `Attempt`: id, profileId, exerciseId, startedAt, finishedAt, completed, points, maxPoints, stars, results (per target: targetId, color, redAttempts, centsAtAcceptance).
- `HintState`: profileId, noteKey, consecutiveFirstTryGreens, updatedAt.
- `ManualUnlock`: profileId, exerciseId, createdAt.

Best stars, unlocked exercises, streaks and the leaderboard are computed from these records, not stored.

## 12. Risks to check early

1. Pitchy accuracy and octave errors on the G string (G3 to D4), where the fundamental is weak relative to the harmonics.
2. Re-attack detection on repeated notes played by beginners, so that nobody gets stuck on a repeated note.
3. abcjs support for the `!0!` finger decoration and for mapping rendered note elements back to targets.
4. Microphone constraint handling and AudioWorklet behavior in Firefox.
5. Road noise: whether the high-pass filter and the noise-floor gate are enough in the real room.

## 13. After v1

1. **Play-along stage** for each exercise: metronome, latency calibration, timing evaluation. Stars move to this stage, and wait mode becomes the learning stage.
2. MusicXML import (xml2abc), so that Suzuki pieces can be used.
3. PWA installation and Android testing.
4. Optional sync on a free hosting tier, and teacher features.
5. Dynamics and articulation (Level 3 of the original brief).
