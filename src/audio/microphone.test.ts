import { expect, test } from 'vitest'
import { voiceProcessingLeftOn } from './microphone'

test('lists only the processing the browser reports as still on', () => {
  const settings = { autoGainControl: true, noiseSuppression: false, echoCancellation: true }
  expect(voiceProcessingLeftOn(settings)).toEqual(['autoGainControl', 'echoCancellation'])
})

test('nothing is listed when the browser turned everything off', () => {
  const settings = { autoGainControl: false, noiseSuppression: false, echoCancellation: false }
  expect(voiceProcessingLeftOn(settings)).toEqual([])
})

test('a setting the browser does not report gives no warning', () => {
  expect(voiceProcessingLeftOn({})).toEqual([])
})
