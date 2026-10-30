import { median } from './note-tracker'

/** Median pitch over a short window, for the tuning needle. Resets on any unvoiced frame. */
export class PitchSmoother {
  private readonly windowMs: number
  private samples: { timeMs: number; hz: number }[] = []

  constructor(windowMs = 100) {
    this.windowMs = windowMs
  }

  push(hz: number | null, timeMs: number): number | null {
    if (hz === null) {
      this.samples = []
      return null
    }
    this.samples.push({ timeMs, hz })
    while (this.samples[0].timeMs <= timeMs - this.windowMs) this.samples.shift()
    return median(this.samples.map((s) => s.hz))
  }
}
