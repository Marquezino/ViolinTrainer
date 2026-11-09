// Runs on the audio thread: filters the microphone signal and posts overlapping frames.
import { FRAME_SIZE, FrameCollector, HOP_SIZE } from '../analysis/frame-collector'
import { HIGH_PASS_HZ, HighPassFilter } from '../analysis/highpass'

export interface FrameMessage {
  frame: Float32Array
  endSample: number
}

class FrameCollectorProcessor extends AudioWorkletProcessor {
  private readonly filter = new HighPassFilter(HIGH_PASS_HZ, sampleRate)
  private readonly collector = new FrameCollector(FRAME_SIZE, HOP_SIZE, (frame, endSample) => {
    const message: FrameMessage = { frame, endSample }
    this.port.postMessage(message, [frame.buffer])
  })

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (channel) this.collector.push(this.filter.process(channel))
    return true
  }
}

registerProcessor('frame-collector', FrameCollectorProcessor)
