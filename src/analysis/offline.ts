import { FRAME_SIZE, FrameCollector, HOP_SIZE } from './frame-collector'
import { createFrameAnalyzer, type TimedFrame } from './frame-analyzer'
import { HIGH_PASS_HZ, HighPassFilter } from './highpass'

/** Runs a whole recording through the same steps as the live microphone path. */
export function analyzeSignal(samples: Float32Array, sampleRate: number): TimedFrame[] {
  const filtered = new HighPassFilter(HIGH_PASS_HZ, sampleRate).process(samples)
  const analyze = createFrameAnalyzer(FRAME_SIZE, HOP_SIZE)
  const frames: TimedFrame[] = []
  const collector = new FrameCollector(FRAME_SIZE, HOP_SIZE, (frame, endSample) => {
    frames.push({ ...analyze(frame, sampleRate), timeMs: (endSample / sampleRate) * 1000 })
  })
  collector.push(filtered)
  return frames
}
