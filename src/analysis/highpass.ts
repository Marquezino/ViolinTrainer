/** Removes traffic rumble below the violin's lowest note (G3, 196 Hz). */
export const HIGH_PASS_HZ = 150

/** Second-order (Butterworth) high-pass filter, RBJ cookbook form. Keeps state across blocks. */
export class HighPassFilter {
  private readonly b0: number
  private readonly b1: number
  private readonly b2: number
  private readonly a1: number
  private readonly a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(cutoffHz: number, sampleRate: number, q = Math.SQRT1_2) {
    const w0 = (2 * Math.PI * cutoffHz) / sampleRate
    const alpha = Math.sin(w0) / (2 * q)
    const cos = Math.cos(w0)
    const a0 = 1 + alpha
    this.b0 = (1 + cos) / 2 / a0
    this.b1 = -(1 + cos) / a0
    this.b2 = (1 + cos) / 2 / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }

  process(input: Float32Array, output: Float32Array = new Float32Array(input.length)): Float32Array {
    for (let i = 0; i < input.length; i++) {
      const x = input[i]
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
      this.x2 = this.x1
      this.x1 = x
      this.y2 = this.y1
      this.y1 = y
      output[i] = y
    }
    return output
  }
}
