import { PitchDetector } from 'pitchy'

export interface FrameAnalysis {
  /** Detected fundamental, or null when there is no usable pitch in the violin range. */
  hz: number | null
  /** McLeod clarity, 0..1 (0 when hz is null). */
  clarity: number
  /** Level of the newest `levelWindow` samples in dBFS (short, so bow-change dips show up). */
  rmsDb: number
}

export interface TimedFrame extends FrameAnalysis {
  timeMs: number
}

/** Below open G (196 Hz) by more than a semitone; above anything a beginner plays. */
export const MIN_PITCH_HZ = 180
export const MAX_PITCH_HZ = 2100
const SILENCE_DB = -120

export function rmsDb(frame: Float32Array): number {
  let sum = 0
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
  const rms = Math.sqrt(sum / frame.length)
  return rms > 0 ? Math.max(SILENCE_DB, 20 * Math.log10(rms)) : SILENCE_DB
}

export type FrameAnalyzer = (frame: Float32Array, sampleRate: number) => FrameAnalysis

/**
 * How much better the frame must match itself at twice the period before the octave below is chosen.
 * Measured on synthetic tones: genuine tones (fundamental present, with noise) differ by at most 0.006;
 * octave-up errors with a missing fundamental by at least 0.0196.
 */
const OCTAVE_MARGIN = 0.012

/** Normalized square difference function at an integer lag: 1 when the frame repeats exactly. */
function nsdf(frame: Float32Array, lag: number): number {
  let acf = 0
  let energy = 0
  for (let i = 0; i + lag < frame.length; i++) {
    acf += frame[i] * frame[i + lag]
    energy += frame[i] * frame[i] + frame[i + lag] * frame[i + lag]
  }
  return energy > 0 ? (2 * acf) / energy : 0
}

/** NSDF peak near a fractional lag: parabolic interpolation over the three nearest integer lags. */
function nsdfPeak(frame: Float32Array, lag: number): { value: number; lag: number } {
  const i = Math.round(lag)
  const a = nsdf(frame, i - 1)
  const b = nsdf(frame, i)
  const c = nsdf(frame, i + 1)
  const curvature = a - 2 * b + c
  if (curvature >= 0) return { value: Math.max(a, b, c), lag }
  const offset = (0.5 * (a - c)) / curvature
  return { value: b - 0.25 * (a - c) * offset, lag: i + offset }
}

/**
 * The McLeod method can lock onto the 2nd harmonic when the fundamental is weak (low G-string notes),
 * reporting a pitch one octave too high. If the frame repeats clearly better at twice the detected
 * period, the true pitch is the octave below.
 */
function correctOctaveUp(frame: Float32Array, hz: number, sampleRate: number): number {
  const lag = sampleRate / hz
  if (hz / 2 < MIN_PITCH_HZ || 2 * lag + 1 >= frame.length / 2) return hz
  const below = nsdfPeak(frame, 2 * lag)
  return below.value > nsdfPeak(frame, lag).value + OCTAVE_MARGIN ? sampleRate / below.lag : hz
}

export function createFrameAnalyzer(frameSize: number, levelWindow: number): FrameAnalyzer {
  const detector = PitchDetector.forFloat32Array(frameSize)
  return (frame, sampleRate) => {
    const level = rmsDb(frame.subarray(frame.length - levelWindow))
    const [detected, clarity] = detector.findPitch(frame, sampleRate)
    if (!Number.isFinite(detected) || detected < MIN_PITCH_HZ || detected > MAX_PITCH_HZ) {
      return { hz: null, clarity: 0, rmsDb: level }
    }
    return { hz: correctOctaveUp(frame, detected, sampleRate), clarity, rmsDb: level }
  }
}
