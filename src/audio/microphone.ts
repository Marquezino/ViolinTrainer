import workletUrl from './frame.worklet.ts?worker&url'
import type { FrameMessage } from './frame.worklet'

export type MicrophoneErrorKind = 'denied' | 'notFound' | 'unsupported' | 'other'

export class MicrophoneError extends Error {
  readonly kind: MicrophoneErrorKind

  constructor(kind: MicrophoneErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface Microphone {
  sampleRate: number
  stop(): Promise<void>
}

/** Frames arrive with their time on the audio clock (ms since the microphone started). */
export type FrameHandler = (frame: Float32Array, timeMs: number, sampleRate: number) => void

/**
 * Opens the microphone without the browser's voice processing (which would distort the violin
 * and flatten dynamics) and streams filtered frames. Call from a click handler.
 */
export async function startMicrophone(onFrame: FrameHandler): Promise<Microphone> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    throw new MicrophoneError('unsupported', 'This browser cannot record audio for analysis.')
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false },
    })
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicrophoneError('denied', 'Microphone access was blocked.')
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new MicrophoneError('notFound', 'No microphone was found.')
    }
    throw new MicrophoneError('other', String(e))
  }

  let context: AudioContext
  try {
    context = new AudioContext()
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop())
    throw new MicrophoneError('other', String(e))
  }
  try {
    await context.audioWorklet.addModule(workletUrl)
    const source = context.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(context, 'frame-collector', { numberOfInputs: 1, numberOfOutputs: 1 })
    // Some browsers only run nodes that lead to the destination; a muted gain keeps it silent.
    const mute = context.createGain()
    mute.gain.value = 0
    node.port.onmessage = (event: MessageEvent<FrameMessage>) => {
      const { frame, endSample } = event.data
      onFrame(frame, (endSample / context.sampleRate) * 1000, context.sampleRate)
    }
    source.connect(node)
    node.connect(mute)
    mute.connect(context.destination)
    await context.resume()
    return {
      sampleRate: context.sampleRate,
      async stop() {
        node.port.onmessage = null
        stream.getTracks().forEach((t) => t.stop())
        await context.close()
      },
    }
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop())
    await context.close()
    throw new MicrophoneError('other', String(e))
  }
}
