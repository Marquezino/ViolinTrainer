import { centsBetween } from '../music/pitch'
import type { FrameAnalysis } from './frame-analyzer'

export interface TrackerConfig {
  /** Level of the room without playing, from the microphone check (dBFS). */
  noiseFloorDb: number
  minClarity: number
  minLevelAboveNoiseDb: number
  /** A confirmed note ends when the pitch moves this far from it (a new note or a correction). */
  stabilityCents: number
  /** A note is confirmed when its newest minStableMs of pitch stay within this total spread... */
  maxSpreadCents: number
  /**
   * ...and the pitch is not moving: the first and last thirds of the window differ by at most this.
   * It also bounds how far the judged pitch can be from where a slide settles.
   */
  maxDriftCents: number
  minStableMs: number
  /** Share of the frames in the stable window that must be voiced. */
  minVoicedFraction: number
  /** Silence or dip duration that separates two notes of the same pitch. */
  reattackMs: number
  reattackDipDb: number
}

export const DEFAULT_TRACKER_CONFIG: Omit<TrackerConfig, 'noiseFloorDb'> = {
  minClarity: 0.9,
  minLevelAboveNoiseDb: 12,
  stabilityCents: 25,
  maxSpreadCents: 25,
  maxDriftCents: 4,
  minStableMs: 120,
  minVoicedFraction: 0.8,
  reattackMs: 30,
  reattackDipDb: 6,
}

export interface NoteEvent {
  /** Median pitch over the newest third of the stable window. */
  hz: number
  /** When the stable window began. */
  startMs: number
  /** When the note was confirmed. */
  timeMs: number
}

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

/** Frames heard since sound began, before a note is confirmed. hz is null for unvoiced frames. */
interface Candidate {
  startMs: number
  frames: { timeMs: number; hz: number | null }[]
  peakDb: number
}

/** A confirmed note that is still sounding. */
interface Sounding {
  anchorHz: number
  peakDb: number
  dipSinceMs: number | null
  dipped: boolean
}

/**
 * Turns analyzed frames into note events. Each played note produces exactly one event, judged on
 * the newest stable window (so a slide is judged where it settles, not on the way). A new event
 * needs a pitch move away from the confirmed note, or a re-attack (silence or a level dip).
 */
export class NoteTracker {
  private readonly config: TrackerConfig
  private candidate: Candidate | null = null
  private sounding: Sounding | null = null
  private unvoicedSinceMs: number | null = null
  private lastFrameMs: number | null = null

  constructor(config: TrackerConfig) {
    this.config = config
  }

  push(frame: FrameAnalysis, timeMs: number): NoteEvent | null {
    const c = this.config
    // Each frame's level covers the interval since the previous frame, so durations include it.
    const intervalMs = this.lastFrameMs === null ? 0 : timeMs - this.lastFrameMs
    this.lastFrameMs = timeMs

    if (!isVoiced(frame, c)) {
      this.unvoicedSinceMs ??= timeMs - intervalMs
      if (timeMs - this.unvoicedSinceMs >= c.reattackMs) {
        this.candidate = null
        this.sounding = null
        return null
      }
      if (this.sounding) this.markDip(this.sounding, timeMs, intervalMs)
      this.candidate?.frames.push({ timeMs, hz: null })
      return null
    }
    this.unvoicedSinceMs = null
    const hz = frame.hz as number

    if (this.sounding) {
      const moved = Math.abs(centsBetween(hz, this.sounding.anchorHz)) > c.stabilityCents
      if (!moved && !this.detectReattack(this.sounding, frame.rmsDb, timeMs, intervalMs)) return null
      this.sounding = null
      this.candidate = null
    }

    if (this.candidate === null) {
      this.candidate = { startMs: timeMs, frames: [], peakDb: frame.rmsDb }
    }
    const candidate = this.candidate
    candidate.frames.push({ timeMs, hz })
    candidate.peakDb = Math.max(candidate.peakDb, frame.rmsDb)
    return this.tryConfirm(candidate, timeMs)
  }

  private tryConfirm(candidate: Candidate, timeMs: number): NoteEvent | null {
    const c = this.config
    const windowStartMs = timeMs - c.minStableMs
    candidate.frames = candidate.frames.filter((f) => f.timeMs >= windowStartMs)
    if (candidate.startMs > windowStartMs) return null

    const window = candidate.frames
    const pitches = window.flatMap((f) => (f.hz === null ? [] : [f.hz]))
    if (pitches.length < c.minVoicedFraction * window.length) return null

    const center = median(pitches)
    const cents = pitches.map((p) => centsBetween(p, center))
    // Ignore the single most extreme frame on each side, so one glitch does not block a note.
    const sorted = [...cents].sort((a, b) => a - b)
    const trimmed = sorted.length >= 5 ? sorted.slice(1, -1) : sorted
    if (trimmed[trimmed.length - 1] - trimmed[0] > c.maxSpreadCents) return null
    // A slide moves steadily in one direction; a wobble does not.
    const third = Math.max(1, Math.floor(cents.length / 3))
    const drift = median(cents.slice(-third)) - median(cents.slice(0, third))
    if (Math.abs(drift) > c.maxDriftCents) return null

    // Judge the newest third of the window: where the pitch settled, not the tail of a slide into it.
    const settledHz = median(pitches.slice(-third))
    this.candidate = null
    this.sounding = { anchorHz: settledHz, peakDb: candidate.peakDb, dipSinceMs: null, dipped: false }
    return { hz: settledHz, startMs: windowStartMs, timeMs }
  }

  /** Tracks level dips within a sounding note; true when the level comes back after a long enough dip. */
  private detectReattack(s: Sounding, levelDb: number, timeMs: number, intervalMs: number): boolean {
    if (levelDb < s.peakDb - this.config.reattackDipDb) {
      this.markDip(s, timeMs, intervalMs)
      return false
    }
    const recovered = s.dipped
    s.dipSinceMs = null
    s.dipped = false
    s.peakDb = Math.max(s.peakDb, levelDb)
    return recovered
  }

  /** Low or unvoiced frames inside a sounding note both count toward a dip. */
  private markDip(s: Sounding, timeMs: number, intervalMs: number): void {
    s.dipSinceMs ??= timeMs - intervalMs
    if (timeMs - s.dipSinceMs >= this.config.reattackMs) s.dipped = true
  }
}
