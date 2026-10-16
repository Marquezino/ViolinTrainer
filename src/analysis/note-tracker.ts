import { centsBetween } from '../music/pitch'
import type { FrameAnalysis } from './frame-analyzer'

export interface TrackerConfig {
  /** Level of the room without playing, from the microphone check (dBFS). */
  noiseFloorDb: number
  minClarity: number
  minLevelAboveNoiseDb: number
  /** Frames must stay within this many cents of the run's median to count as one stable note. */
  stabilityCents: number
  minStableMs: number
  /** Silence or dip duration that separates two notes of the same pitch. */
  reattackMs: number
  reattackDipDb: number
}

export const DEFAULT_TRACKER_CONFIG: Omit<TrackerConfig, 'noiseFloorDb'> = {
  minClarity: 0.9,
  minLevelAboveNoiseDb: 12,
  stabilityCents: 25,
  minStableMs: 120,
  reattackMs: 30,
  reattackDipDb: 6,
}

export interface NoteEvent {
  /** Median pitch over the stable window. */
  hz: number
  /** When the run of stable frames began. */
  startMs: number
  /** When the note was confirmed (startMs + at least minStableMs). */
  timeMs: number
}

const MEDIAN_WINDOW = 32

export function isVoiced(frame: FrameAnalysis, config: TrackerConfig): boolean {
  return (
    frame.hz !== null &&
    frame.clarity >= config.minClarity &&
    frame.rmsDb >= config.noiseFloorDb + config.minLevelAboveNoiseDb
  )
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

interface Run {
  startMs: number
  pitches: number[]
  peakDb: number
  emitted: boolean
  dipSinceMs: number | null
  dipped: boolean
}

/**
 * Turns analyzed frames into note events. Each played note produces exactly one event:
 * a new event needs a pitch change, or a re-attack (silence or a level dip, then a rise).
 */
export class NoteTracker {
  private readonly config: TrackerConfig
  private run: Run | null = null
  private unvoicedSinceMs: number | null = null

  constructor(config: TrackerConfig) {
    this.config = config
  }

  push(frame: FrameAnalysis, timeMs: number): NoteEvent | null {
    const c = this.config
    if (!isVoiced(frame, c)) {
      this.unvoicedSinceMs ??= timeMs
      if (this.run && timeMs - this.unvoicedSinceMs >= c.reattackMs) this.run = null
      else if (this.run?.emitted) this.markDip(this.run, timeMs)
      return null
    }
    this.unvoicedSinceMs = null
    const hz = frame.hz as number

    if (this.run === null || Math.abs(centsBetween(hz, median(this.run.pitches))) > c.stabilityCents) {
      this.run = newRun(hz, frame.rmsDb, timeMs)
    } else if (this.run.emitted) {
      if (this.detectReattack(this.run, frame.rmsDb, timeMs)) this.run = newRun(hz, frame.rmsDb, timeMs)
      else this.addPitch(this.run, hz)
    } else {
      this.addPitch(this.run, hz)
      this.run.peakDb = Math.max(this.run.peakDb, frame.rmsDb)
    }

    const run = this.run
    if (!run.emitted && timeMs - run.startMs >= c.minStableMs) {
      run.emitted = true
      return { hz: median(run.pitches), startMs: run.startMs, timeMs }
    }
    return null
  }

  /** Tracks level dips within a sounding note; true when the level comes back after a long enough dip. */
  private detectReattack(run: Run, levelDb: number, timeMs: number): boolean {
    if (levelDb < run.peakDb - this.config.reattackDipDb) {
      this.markDip(run, timeMs)
      return false
    }
    const recovered = run.dipped
    run.dipSinceMs = null
    run.dipped = false
    run.peakDb = Math.max(run.peakDb, levelDb)
    return recovered
  }

  /** Low or unvoiced frames inside a sounding note both count toward a dip. */
  private markDip(run: Run, timeMs: number): void {
    run.dipSinceMs ??= timeMs
    if (timeMs - run.dipSinceMs >= this.config.reattackMs) run.dipped = true
  }

  private addPitch(run: Run, hz: number): void {
    run.pitches.push(hz)
    if (run.emitted && run.pitches.length > MEDIAN_WINDOW) run.pitches.shift()
  }
}

function newRun(hz: number, levelDb: number, timeMs: number): Run {
  return { startMs: timeMs, pitches: [hz], peakDb: levelDb, emitted: false, dipSinceMs: null, dipped: false }
}
