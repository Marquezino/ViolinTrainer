# Violin Trainer

A practice app for beginner violinists that runs in the browser. You write an exercise in [ABC notation](https://abcnotation.com/), see it as sheet music, and play it on your violin. The app listens through the microphone and moves on only when you play the right note in tune (wait mode). It shows a tuning needle, green, yellow or red feedback, fading fingering hints, and stars at the end.

**Status:** early. The core practice loop works and is covered by unit and end-to-end tests with generated tones, but it hasn't been checked with a real violin yet. Profiles, an exercise editor and a learning path are planned.

## Running it

Requires Node 24 or later.

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173) in Chrome or Firefox, allow the microphone, and tune to A = 440 Hz.

## Development

```bash
npm test             # unit tests (Vitest)
npm run typecheck
npm run build
npm run e2e          # end-to-end tests in Chrome with a fake microphone (Playwright)
```

The design spec and implementation plans are in [`docs/superpowers/`](docs/superpowers/). Issues are tracked with [Beads](https://github.com/gastownhall/beads): run `bd ready` to see open work.

## License

[MIT](LICENSE)
