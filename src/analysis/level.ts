/**
 * Practice is blocked when the room is louder than this (spec section 10). A violin at playing
 * distance is around -30 to -15 dBFS, and notes must be 12 dB above the floor to count, so a louder
 * room would hide most notes. -50 blocked ordinary quiet rooms with computer-fan noise.
 */
export const MAX_NOISE_FLOOR_DB = -35
/** Above this the room is usable, but soft notes may go unheard; the practice screen says so. */
export const NOISY_ROOM_HINT_DB = -50
/** How long the microphone check listens to the quiet room. */
export const NOISE_CHECK_MS = 2000

/** Noise floor = 90th percentile of the frame levels heard while nobody plays. */
export function noiseFloorDb(levelsDb: readonly number[]): number {
  if (levelsDb.length === 0) throw new Error('noiseFloorDb needs at least one level')
  const sorted = [...levelsDb].sort((a, b) => a - b)
  return sorted[Math.floor(0.9 * (sorted.length - 1))]
}

export function isTooNoisy(floorDb: number): boolean {
  return floorDb > MAX_NOISE_FLOOR_DB
}

/** More pitched frames than this during the room check means someone was playing. */
export const MAX_PITCHED_FRACTION = 0.1
const PITCHED_CLARITY = 0.9

/** A frame with a clear pitch, however quiet. */
export function isPitched(frame: { hz: number | null; clarity: number }): boolean {
  return frame.hz !== null && frame.clarity >= PITCHED_CLARITY
}
