/** Synthetic test signals with known content. Test-only code. */

export const SAMPLE_RATE = 48000

/** Relative harmonic amplitudes roughly like a bowed violin. */
export const VIOLIN_HARMONICS = [1, 0.6, 0.5, 0.35, 0.3, 0.2, 0.15, 0.1]
/** Low notes on the G string: weak fundamental, strong 2nd and 3rd harmonics. */
export const WEAK_FUNDAMENTAL_HARMONICS = [0.15, 1, 0.8, 0.5, 0.3, 0.2]

export interface ToneSpec {
  hz: number
  ms: number
  amplitude?: number
  harmonics?: number[]
  /** Pitch at the end of the tone; the pitch moves linearly in cents (a slide). */
  endHz?: number
  vibrato?: { rateHz: number; widthCents: number }
  attackMs?: number
  releaseMs?: number
}

export function tone(spec: ToneSpec, sampleRate = SAMPLE_RATE): Float32Array {
  const n = Math.round((spec.ms / 1000) * sampleRate)
  const out = new Float32Array(n)
  const harmonics = spec.harmonics ?? [1]
  const norm = harmonics.reduce((a, b) => a + b, 0)
  const amplitude = spec.amplitude ?? 0.3
  const attack = Math.round(((spec.attackMs ?? 10) / 1000) * sampleRate)
  const release = Math.round(((spec.releaseMs ?? 10) / 1000) * sampleRate)
  const slideCents = spec.endHz ? 1200 * Math.log2(spec.endHz / spec.hz) : 0
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    let cents = slideCents * (i / n)
    if (spec.vibrato) cents += spec.vibrato.widthCents * Math.sin(2 * Math.PI * spec.vibrato.rateHz * t)
    const f = spec.hz * 2 ** (cents / 1200)
    phase += (2 * Math.PI * f) / sampleRate
    let s = 0
    for (let h = 0; h < harmonics.length; h++) s += harmonics[h] * Math.sin((h + 1) * phase)
    let env = 1
    if (i < attack) env = i / attack
    if (i >= n - release) env = Math.min(env, (n - i) / release)
    out[i] = (amplitude * env * s) / norm
  }
  return out
}

export function silence(ms: number, sampleRate = SAMPLE_RATE): Float32Array {
  return new Float32Array(Math.round((ms / 1000) * sampleRate))
}

/** Deterministic white noise. */
export function noise(ms: number, amplitude: number, seed = 1, sampleRate = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(Math.round((ms / 1000) * sampleRate))
  let state = seed >>> 0
  for (let i = 0; i < out.length; i++) {
    state = (state + 0x6d2b79f5) >>> 0
    let x = state
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    const r = ((x ^ (x >>> 14)) >>> 0) / 4294967296
    out[i] = amplitude * (2 * r - 1)
  }
  return out
}

/** Traffic-like low rumble: a few low sinusoids. */
export function rumble(ms: number, amplitude: number, sampleRate = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(Math.round((ms / 1000) * sampleRate))
  const parts = [
    { hz: 35, phase: 0.3 },
    { hz: 52, phase: 1.1 },
    { hz: 71, phase: 2.0 },
    { hz: 94, phase: 0.7 },
  ]
  for (let i = 0; i < out.length; i++) {
    let s = 0
    for (const p of parts) s += Math.sin(2 * Math.PI * p.hz * (i / sampleRate) + p.phase)
    out[i] = (amplitude * s) / parts.length
  }
  return out
}

export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/** Sample-wise sum; the result is as long as the longest input. */
export function mix(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(Math.max(...parts.map((p) => p.length)))
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i]
  return out
}
