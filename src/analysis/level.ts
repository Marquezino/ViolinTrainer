/** Practice is blocked when the room is louder than this (spec section 10). */
export const MAX_NOISE_FLOOR_DB = -50
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
