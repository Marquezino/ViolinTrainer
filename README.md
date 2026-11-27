# Violin Trainer

A practice app for beginner violinists that runs in the browser. You write an exercise in [ABC notation](https://en.wikipedia.org/wiki/ABC_notation), see it as sheet music, and play it on your violin. The app listens through the microphone and moves on only when you play the right note in tune (wait mode). It shows a tuning needle, green, yellow or red feedback, fading fingering hints, and stars at the end. Each learner has a profile with a learning path of built-in units that unlock as stars are earned, two streaks, a daily minutes goal, a weekly family leaderboard, and a tuning screen before practice.

**Status:** early. The core practice loop works, has been checked by hand with a real violin, and is covered by unit and end-to-end tests with generated tones. Profiles, the learning path, streaks and backups work. The parent area (PIN) and the exercise editor come next.

## Running it

Open https://marquezino.github.io/ViolinTrainer/ in Chrome or Firefox. It is rebuilt from `main` after every change that passes the tests. Everything runs in the browser: no audio leaves your computer.

To run it locally instead (requires Node 24 or later):

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173) in Chrome or Firefox, allow the microphone, and tune to A = 440 Hz.

## Install on a tablet

Open the address above in Chrome on the tablet, then use the menu and choose Install app (or Add to home screen). The app opens full screen like any other app. It still needs the network to load; there is no offline mode yet.

## Your data and backups

Profiles and progress are stored only in the browser on that device. Clearing site data erases them. Export a backup from the settings regularly (the app reminds you), and import it to move to another device.

## Development

```bash
npm test             # unit tests (Vitest)
npm run typecheck
npm run build
npm run e2e          # end-to-end tests in Chrome with a fake microphone (Playwright)
```

The app is available in English and Brazilian Portuguese; it picks the language from the browser and has a language menu. To add a language, copy `src/i18n/messages/en.ts`, add the locale to `LOCALES`, `LOCALE_LABELS` (in `src/i18n/locales.ts`), the detection table there and `MESSAGES` (in `src/i18n/messages/index.ts`), then fix whatever `npm run typecheck` lists.

The design spec and implementation plans are in [`docs/superpowers/`](docs/superpowers/). Issues are tracked with [Beads](https://github.com/gastownhall/beads): run `bd ready` to see open work.

## License

[MIT](LICENSE)
