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
- A frame's level is measured over its newest 512 samples (about 11 ms), so that short dips at bow changes are visible.
- A frame is **voiced** when clarity ≥ 0.90 and its level is at least 12 dB above the noise floor measured by the microphone check.
- The pitch detector can lock onto the 2nd harmonic when the fundamental is weak (low G-string notes). When the frame repeats clearly better at twice the detected period, the octave below is used.
- A **note event** is confirmed when the newest **120 ms** of sound:
  - are at least 80% voiced;
  - stay within a total pitch spread of 25 cents (ignoring the most extreme frame on each side);
  - are not moving: the medians of the first and last thirds of the window differ by at most 4 cents.
- The note's pitch is the median of the newest third of that window, which is where a slide settles, not the slide itself. Slides faster than about 50 cents per second are never judged mid-slide.
- A new note event requires either:
  - a pitch move of more than 25 cents away from the confirmed note (a new pitch, a slur, or the player correcting intonation), or
  - a **re-attack**: for at least 30 ms the level stays at least 6 dB below the note's peak, or the frames become unvoiced (both count toward the same dip), and then the level rises again. Each frame counts for the time since the previous frame.
- A pitch that moves away and settles back within 25 cents of the held note, without a re-attack, is a glitch: no new event.
- Each note event records whether it followed a re-attack (or silence) or only a pitch move.
- After a rejection the tracker **re-judges** the held note: when it settles (a 240 ms stable window, so the start of a slow slide is not taken for a settled pitch) at least 5 cents from its last judged pitch, or closer but on the other side of a tolerance limit (for example from 38 to 34 cents sharp, across the 35-cent yellow limit), a new event is sent. A small correction into tune is therefore noticed without a re-attack.
- Each note event is judged once by the session, except:
  - after an acceptance, a pitch move without a re-attack that stays on the same semitone is an adjustment of the held note, also when it comes back there after a detour to another note. It is not judged, so a repeated note always needs a re-attack, and adjusting a held note is never a wrong attempt at the next target;
  - a rejected event without a re-attack on the target that was just rejected is the same attempt (one bow stroke): it updates the message but adds no red attempt.
- During the room check, more than 10% of frames with a clear pitch means someone played. Practice is then blocked with a "stay quiet during the check" message, because the measured noise floor would hide soft notes.

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

Each note shows one color, with no rings or other marks: green, yellow, or red for a target that needed more than one try (red from the first rejection on, and still red once accepted). Such a target earns at most the points of a yellow note. A bar before the next note to play separates the played notes from the rest.

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

| String | 0 | 1 (low / normal) | 2 (low / high) | 3 (normal / high) | 4 |
|---|---|---|---|---|---|
| G | G3 | A♭3 / A3 | B♭3 / B3 | C4 / C♯4 | D4 |
| D | D4 | E♭4 / E4 | F4 / F♯4 | G4 / G♯4 | A4 |
| A | A4 | B♭4 / B4 | C5 / C♯5 | D5 / D♯5 | E5 |
| E | E5 | F5 / F♯5 | G5 / G♯5 | A5 / A♯5 | B5 |

- Range: G3 to B5. Notes above it trigger an editor warning and show no hint. Notes below G3 are an editor error, because they cannot be played on a violin. Notes above B6 are an editor error, because the pitch detector stops at 2100 Hz and could never accept them.
- Repeat signs, first and second endings, and ties between different pitches are editor errors in v1, because the app would otherwise expect a different note sequence than the one written. A tie continuation with its own accidental must resolve to the same pitch; without one it keeps the tied note's pitch, also across a bar line.
- A tied note is one target; every note in the tie shows its state.
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
| Noise floor too high (limit −35 dBFS after the high-pass filter; −50 blocked quiet rooms with fan noise) | Practice is blocked, with an explanation. Between −50 and −35 dBFS practice runs with a hint to play with a full sound. |
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

Status after the plan 1 prototype (synthetic audio and headless Chrome only; real playing is still untested):

1. Pitchy accuracy and octave errors on the G string (G3 to D4), where the fundamental is weak relative to the harmonics. *Synthetic tones: within 1 cent. Octave-up errors with a missing fundamental are corrected by the sub-octave check, and that check never moved a tone with its fundamental present. Needs real recordings.*
2. Re-attack detection on repeated notes played by beginners, so that nobody gets stuck on a repeated note. *Dips of 40 ms (about 10 dB) are detected at any alignment at 44.1 and 48 kHz. Needs real recordings.*
3. abcjs support for the `!0!` finger decoration and for mapping rendered note elements back to targets. *Resolved: both work.*
4. Microphone constraint handling and AudioWorklet behavior in Firefox. *Chrome works through its fake microphone; Firefox still needs a manual check.*
5. Road noise: whether the high-pass filter and the noise-floor gate are enough in the real room. *Rumble up to half the violin's level does not disturb the pitch. Louder rumble gives no pitch rather than a wrong one.*
6. **Known limitations:**
   - Wide vibrato may take several cycles to be accepted. A ±12-cent vibrato is accepted at most once, judged within its width.
   - Slides slower than about 50 cents per second that pass through the target are credited when they pass. In a 120 ms window they cannot be told apart from a held note. When re-judging after a rejection the window is 240 ms, so the limit there is about 25 cents per second.
   - A brief disturbance (about 30 ms) right where a slow slide (under about 80 cents per second) stops can hide the last of the movement. The note is then judged a few cents short of where it settles. Found with synthetic tones joined mid-slide; real recordings will show whether bow noise does the same.
   - These are acceptable for beginners in v1.

## 13. After v1

1. **Play-along stage** for each exercise: metronome, latency calibration, timing evaluation. Stars move to this stage, and wait mode becomes the learning stage.
2. MusicXML import (xml2abc), so that Suzuki pieces can be used.
3. PWA installation and Android testing.
4. Optional sync on a free hosting tier, and teacher features.
5. Dynamics and articulation (Level 3 of the original brief).
