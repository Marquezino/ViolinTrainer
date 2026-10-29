import type { TimedFrame } from '../analysis/frame-analyzer'
import { MAX_PITCHED_FRACTION, NOISE_CHECK_MS, isPitched, isTooNoisy, noiseFloorDb } from '../analysis/level'
import {
  DEFAULT_TRACKER_CONFIG,
  NoteTracker,
  isVoiced,
  type NoteEvent,
  type TrackerConfig,
} from '../analysis/note-tracker'
import { PitchSmoother } from '../analysis/pitch-smoother'
import { centsBetween, hzToMidiFloat, midiToHz, noteName, type Judgement } from '../music/pitch'
import { scoreRun, type RunResult } from './scoring'
import { onNote, onTick, startSession, type SessionConfig, type WaitSessionState } from './wait-session'

export type EnginePhase = 'measuringNoise' | 'tooNoisy' | 'practicing' | 'finished'

/** Why practice was blocked: a loud room, or someone playing during the room check. */
export type NoiseProblem = 'loud' | 'playing'

export interface NeedleReading {
  /** Deviation of the current sound from the current target. */
  cents: number
  /** Name of the note being played when it is more than 50 cents away from the target. */
  playedName: string | null
}

export interface Rejection {
  index: number
  kind: Judgement['kind']
  playedName: string
}

export interface EngineSnapshot {
  phase: EnginePhase
  /** Fraction of the microphone check done, 0..1. */
  noiseCheckProgress: number
  noiseFloorDb: number | null
  noiseProblem: NoiseProblem | null
  session: WaitSessionState
  needle: NeedleReading | null
  lastRejection: Rejection | null
  result: RunResult | null
}

/** What the previous note event did, to tell a new note from an adjustment of the one still sounding. */
interface LastJudged {
  index: number
  accepted: boolean
  /** The equal-tempered note that was played. */
  playedMidi: number
}

/** Everything between analyzed microphone frames and what the practice screen shows. No audio, no DOM. */
export class PracticeEngine {
  private readonly sessionConfig: SessionConfig
  private readonly smoother = new PitchSmoother(100)
  private readonly levels: number[] = []
  private pitchedFrames = 0
  private firstFrameMs: number | null = null
  private tracker: NoteTracker | null = null
  private trackerConfig: TrackerConfig | null = null
  private lastJudged: LastJudged | null = null
  private current: EngineSnapshot

  constructor(session: WaitSessionState) {
    this.sessionConfig = session.config
    this.current = {
      phase: 'measuringNoise',
      noiseCheckProgress: 0,
      noiseFloorDb: null,
      noiseProblem: null,
      session,
      needle: null,
      lastRejection: null,
      result: null,
    }
  }

  snapshot(): EngineSnapshot {
    return this.current
  }

  handleFrame(frame: TimedFrame): void {
    const phase = this.current.phase
    if (phase === 'measuringNoise') this.measureNoise(frame)
    else if (phase === 'practicing') this.practice(frame)
  }

  private measureNoise(frame: TimedFrame): void {
    this.firstFrameMs ??= frame.timeMs
    this.levels.push(frame.rmsDb)
    if (isPitched(frame)) this.pitchedFrames++
    const elapsed = frame.timeMs - this.firstFrameMs
    if (elapsed < NOISE_CHECK_MS) {
      this.current = { ...this.current, noiseCheckProgress: elapsed / NOISE_CHECK_MS }
      return
    }
    const floor = noiseFloorDb(this.levels)
    const playing = this.pitchedFrames > MAX_PITCHED_FRACTION * this.levels.length
    if (playing || isTooNoisy(floor)) {
      const noiseProblem: NoiseProblem = playing ? 'playing' : 'loud'
      this.current = { ...this.current, phase: 'tooNoisy', noiseCheckProgress: 1, noiseFloorDb: floor, noiseProblem }
      return
    }
    this.trackerConfig = { ...DEFAULT_TRACKER_CONFIG, noiseFloorDb: floor }
    this.tracker = new NoteTracker(this.trackerConfig)
    const session = startSession(this.current.session.exercise, this.sessionConfig, frame.timeMs)
    this.current = { ...this.current, phase: 'practicing', noiseCheckProgress: 1, noiseFloorDb: floor, session }
  }

  private practice(frame: TimedFrame): void {
    const tracker = this.tracker as NoteTracker
    const trackerConfig = this.trackerConfig as TrackerConfig
    let { session, lastRejection } = this.current

    const note = tracker.push(frame, frame.timeMs)
    if (note && !this.isAdjustmentOfAcceptedNote(note)) {
      const index = session.cursor
      const step = onNote(session, note)
      const rejected = step.events.find((e) => e.type === 'rejected')
      // Correcting the pitch within one bow stroke is the same attempt, not another red one.
      const sameAttempt = rejected && !note.reattacked && this.lastJudged?.index === index && !this.lastJudged.accepted
      if (!sameAttempt) session = step.state
      for (const e of step.events) {
        if (e.type === 'rejected') {
          lastRejection = {
            index: e.index,
            kind: e.judgement.kind,
            playedName: noteName(e.judgement.playedMidi, session.exercise.preferFlats),
          }
          this.lastJudged = { index, accepted: false, playedMidi: e.judgement.playedMidi }
        } else if (e.type === 'accepted') {
          lastRejection = null
          this.lastJudged = { index, accepted: true, playedMidi: e.judgement.playedMidi }
        }
      }
      tracker.setRejudging(rejected !== undefined)
    }
    session = onTick(session, frame.timeMs).state

    const smoothed = this.smoother.push(isVoiced(frame, trackerConfig) ? frame.hz : null, frame.timeMs)
    const needle = session.finished ? null : this.needleFor(session, smoothed)

    if (session.finished) {
      this.current = {
        ...this.current,
        phase: 'finished',
        session,
        needle: null,
        lastRejection,
        result: scoreRun(session.targets, true),
      }
      return
    }
    this.current = { ...this.current, session, needle, lastRejection }
  }

  /**
   * After a note is accepted, moving its pitch without a re-attack while staying on the same note is
   * an adjustment of that note: it neither credits a repeated target nor counts as a wrong attempt.
   */
  private isAdjustmentOfAcceptedNote(note: NoteEvent): boolean {
    const last = this.lastJudged
    if (note.reattacked || !last?.accepted) return false
    return Math.round(hzToMidiFloat(note.hz, this.sessionConfig.a4Hz)) === last.playedMidi
  }

  private needleFor(session: WaitSessionState, hz: number | null): NeedleReading | null {
    if (hz === null) return null
    const target = session.exercise.targets[session.cursor]
    const cents = centsBetween(hz, midiToHz(target.midi, this.sessionConfig.a4Hz))
    const playedName =
      Math.abs(cents) > 50
        ? noteName(Math.round(hzToMidiFloat(hz, this.sessionConfig.a4Hz)), session.exercise.preferFlats)
        : null
    return { cents, playedName }
  }
}
