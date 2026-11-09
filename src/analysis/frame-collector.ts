export const FRAME_SIZE = 2048
export const HOP_SIZE = 512

/**
 * Turns a stream of audio blocks (any size) into overlapping frames.
 * Calls onFrame with a fresh copy of the last `frameSize` samples every `hopSize` samples,
 * and the total number of samples received so far (the frame's end position).
 */
export class FrameCollector {
  private readonly frameSize: number
  private readonly hopSize: number
  private readonly onFrame: (frame: Float32Array, endSample: number) => void
  private readonly buffer: Float32Array
  private position = 0
  private total = 0

  constructor(
    frameSize: number,
    hopSize: number,
    onFrame: (frame: Float32Array, endSample: number) => void,
  ) {
    this.frameSize = frameSize
    this.hopSize = hopSize
    this.onFrame = onFrame
    this.buffer = new Float32Array(frameSize)
  }

  push(block: Float32Array): void {
    for (let i = 0; i < block.length; i++) {
      this.buffer[this.position] = block[i]
      this.position = (this.position + 1) % this.frameSize
      this.total++
      if (this.total >= this.frameSize && (this.total - this.frameSize) % this.hopSize === 0) {
        this.emit()
      }
    }
  }

  private emit(): void {
    const frame = new Float32Array(this.frameSize)
    const tail = this.buffer.subarray(this.position)
    frame.set(tail, 0)
    frame.set(this.buffer.subarray(0, this.position), tail.length)
    this.onFrame(frame, this.total)
  }
}
