/**
 * Fixed-interval “drop” ticks — for visuals or logic (Tier B), not spring physics.
 */

export type DropMetronomeOptions = {
  /** Seconds between drops. */
  intervalSec: number
  /** Called each time an interval elapses; `index` is 1-based. */
  onDrop: (index: number) => void
}

/**
 * Accumulates `dt` and fires `onDrop` every `intervalSec`.
 */
export class DropMetronome {
  private intervalSec: number
  private readonly onDrop: (index: number) => void
  private acc = 0
  private count = 0

  constructor(options: DropMetronomeOptions) {
    this.intervalSec = Math.max(0.05, options.intervalSec)
    this.onDrop = options.onDrop
  }

  /** Advance clock; call from `setFrameCallback`. */
  tick(dt: number): void {
    this.acc += dt
    while (this.acc >= this.intervalSec) {
      this.acc -= this.intervalSec
      this.count += 1
      this.onDrop(this.count)
    }
  }

  setIntervalSec(sec: number): void {
    this.intervalSec = Math.max(0.05, sec)
  }

  get dropCount(): number {
    return this.count
  }

  reset(): void {
    this.acc = 0
    this.count = 0
  }
}
