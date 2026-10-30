import { centsBetween } from '../music/pitch'
import type { FrameAnalysis } from './frame-analyzer'

export interface TrackerConfig {
  /** Level of the room without playing, from the microphone check (dBFS). */
  noiseFloorDb: number
  minClarity: number
  minLevelAboveNoiseDb: number
  /** A confirmed note ends when the pitch moves this far from it (a new note or a correction). */
  stabilityCents: number
  /** While re-judging (after a rejection), a held note settling this far from its last judged pitch is judged again. */
  rejudgeCents: number
  /**
   * Stable window for re-judging a held note. Longer than minStableMs: a held note starting to slide
   * moves too little in 120 ms to tell from a settled one, and here no attack marks the new pitch.
   */
  rejudgeStableMs: number
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
  rejudgeCents: 5,
  rejudgeStableMs: 240,
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
  /**
   * True when the note began after silence or a re-attack; false when the pitch moved within a
   * sounding note (legato, a slide or an intonation correction).
   */
  reattacked: boolean
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

interface TrackedFrame {
  timeMs: number
  /** Null for unvoiced frames. */
  hz: number | null
}

/** Frames heard since sound began, before a note is confirmed. */
interface Candidate {
  startMs: number
  frames: TrackedFrame[]
  peakDb: number
  /** Pitch of the sounding note this candidate moved away from; null after silence or a re-attack. */
  movedFromHz: number | null
}

/** A confirmed note that is still sounding. */
interface Sounding {
  anchorHz: number
  peakDb: number
  dipSinceMs: number | null
  dipped: boolean
  /** Newest frames of the note, kept while re-judging. */
  recent: TrackedFrame[]
  recentSinceMs: number
}

/**
 * Turns analyzed frames into note events. Each played note produces exactly one event, judged on
 * the newest stable window (so a slide is judged where it settles, not on the way). A new event
 * needs a pitch move away from the confirmed note, or a re-attack (silence or a level dip). A pitch
 * that only wanders off and comes back to the held note (a glitch) gives no new event.
 */
export class NoteTracker {
  private readonly config: TrackerConfig
  private candidate: Candidate | null = null
  private sounding: Sounding | null = null
  private unvoicedSinceMs: number | null = null
  private lastFrameMs: number | null = null
  private rejudging = false
  private changesVerdict: (fromHz: number, toHz: number) => boolean = () => false

  constructor(config: TrackerConfig) {
    this.config = config
  }

  /**
   * While on (after the last note was rejected), a held note that settles at least `rejudgeCents`
   * from its judged pitch gives a new event, so a small correction into tune is noticed. A smaller
   * change also gives one when `changesVerdict` says it crosses a tolerance limit.
   */
  setRejudging(on: boolean, changesVerdict: (fromHz: number, toHz: number) => boolean = () => false): void {
    this.rejudging = on
    this.changesVerdict = changesVerdict
    if (this.sounding) {
      this.sounding.recent = []
      this.sounding.recentSinceMs = this.lastFrameMs ?? 0
    }
  }

  /** How far the pitch must settle from a judged pitch to be a new event. */
  private minChangeCents(): number {
    return this.rejudging ? this.config.rejudgeCents : this.config.stabilityCents
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
      if (this.sounding) {
        this.markDip(this.sounding, timeMs, intervalMs)
        if (this.rejudging) this.sounding.recent.push({ timeMs, hz: null })
      }
      this.candidate?.frames.push({ timeMs, hz: null })
      return null
    }
    this.unvoicedSinceMs = null
    const hz = frame.hz as number

    let movedFromHz: number | null = null
    if (this.sounding) {
      const s = this.sounding
      const moved = Math.abs(centsBetween(hz, s.anchorHz)) > c.stabilityCents
      const reattacked = this.detectReattack(s, frame.rmsDb, timeMs, intervalMs)
      if (!moved && !reattacked) return this.rejudging ? this.rejudgeHeld(s, hz, timeMs) : null
      movedFromHz = reattacked ? null : s.anchorHz
      this.sounding = null
      this.candidate = null
    }

    if (this.candidate === null) {
      this.candidate = { startMs: timeMs, frames: [], peakDb: frame.rmsDb, movedFromHz }
    }
    const candidate = this.candidate
    candidate.frames.push({ timeMs, hz })
    candidate.peakDb = Math.max(candidate.peakDb, frame.rmsDb)
    return this.tryConfirm(candidate, timeMs)
  }

  private tryConfirm(candidate: Candidate, timeMs: number): NoteEvent | null {
    const windowStartMs = timeMs - this.config.minStableMs
    candidate.frames = candidate.frames.filter((f) => f.timeMs >= windowStartMs)
    if (candidate.startMs > windowStartMs) return null
    const settledHz = this.settledPitch(candidate.frames)
    if (settledHz === null) return null

    this.candidate = null
    const sounding: Sounding = {
      anchorHz: settledHz,
      peakDb: candidate.peakDb,
      dipSinceMs: null,
      dipped: false,
      recent: [],
      recentSinceMs: timeMs,
    }
    const from = candidate.movedFromHz
    if (from !== null && Math.abs(centsBetween(settledHz, from)) <= this.minChangeCents()) {
      // The pitch came back to the held note: still the same note, not a new one.
      this.sounding = { ...sounding, anchorHz: from }
      return null
    }
    this.sounding = sounding
    return { hz: settledHz, startMs: windowStartMs, timeMs, reattacked: from === null }
  }

  /** While re-judging: a new event when the held note settles somewhere new. */
  private rejudgeHeld(s: Sounding, hz: number, timeMs: number): NoteEvent | null {
    const windowStartMs = timeMs - this.config.rejudgeStableMs
    s.recent.push({ timeMs, hz })
    s.recent = s.recent.filter((f) => f.timeMs >= windowStartMs)
    if (s.recentSinceMs > windowStartMs) return null
    const settledHz = this.settledPitch(s.recent)
    if (settledHz === null) return null
    const small = Math.abs(centsBetween(settledHz, s.anchorHz)) < this.config.rejudgeCents
    if (small && !this.changesVerdict(s.anchorHz, settledHz)) return null
    s.anchorHz = settledHz
    s.recent = []
    s.recentSinceMs = timeMs
    return { hz: settledHz, startMs: windowStartMs, timeMs, reattacked: false }
  }

  /** The pitch where a full stable window settled, or null when the window is not stable. */
  private settledPitch(window: readonly TrackedFrame[]): number | null {
    const c = this.config
    const pitches = window.flatMap((f) => (f.hz === null ? [] : [f.hz]))
    if (pitches.length === 0 || pitches.length < c.minVoicedFraction * window.length) return null

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
    return median(pitches.slice(-third))
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
