/** A pause this long or longer between two notes is not practice time. */
export const ACTIVE_GAP_MS = 30_000

/**
 * Time actually spent playing: the gaps between the start and each note, leaving out long pauses.
 * It ends at the last note, so an abandoned run counts up to its last note.
 */
export class ActiveTimer {
  private lastMs: number
  private total = 0

  constructor(startMs: number) {
    this.lastMs = startMs
  }

  noteAt(ms: number): void {
    const gap = ms - this.lastMs
    if (gap < ACTIVE_GAP_MS) this.total += gap
    this.lastMs = ms
  }

  get activeMs(): number {
    return this.total
  }
}
