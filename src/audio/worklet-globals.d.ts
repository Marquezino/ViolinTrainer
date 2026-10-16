// Globals of the AudioWorkletGlobalScope, used only by frame.worklet.ts.
// The DOM library does not declare them.

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean
}

declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

declare const sampleRate: number
