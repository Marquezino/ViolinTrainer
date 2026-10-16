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

export function createFrameAnalyzer(frameSize: number, levelWindow: number): FrameAnalyzer {
  const detector = PitchDetector.forFloat32Array(frameSize)
  return (frame, sampleRate) => {
    const level = rmsDb(frame.subarray(frame.length - levelWindow))
    const [hz, clarity] = detector.findPitch(frame, sampleRate)
    if (!Number.isFinite(hz) || hz < MIN_PITCH_HZ || hz > MAX_PITCH_HZ) {
      return { hz: null, clarity: 0, rmsDb: level }
    }
    return { hz, clarity, rmsDb: level }
  }
}
