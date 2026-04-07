/**
 * CPU 2D wave ripple heightfield — discrete wave equation on a grid.
 * Not fluid dynamics; suitable for “flat pool” visuals under UI (Tier B in docs/VISION_AND_LIMITS.md).
 */

export type RippleSurfaceOptions = {
  /** Edge decay 0..1 per step; higher = ripples last longer. Default ~0.988 */
  damping?: number
}

/**
 * Square-ish grid; `cols` × `rows` cells. Buffers are zeroed at edges each step.
 */
export class RippleSurface2D {
  readonly cols: number
  readonly rows: number
  private damping: number
  private uPrev: Float32Array
  private uCurr: Float32Array
  private uNext: Float32Array
  private scratch: HTMLCanvasElement | null = null

  constructor(cols: number, rows: number, options?: RippleSurfaceOptions) {
    if (cols < 4 || rows < 4) throw new Error('RippleSurface2D: cols and rows must be at least 4')
    this.cols = cols
    this.rows = rows
    this.damping = options?.damping ?? 0.988
    const n = cols * rows
    this.uPrev = new Float32Array(n)
    this.uCurr = new Float32Array(n)
    this.uNext = new Float32Array(n)
  }

  /** One integration step (call once per frame at ~60fps). */
  step(): void {
    const w = this.cols
    const h = this.rows
    const damp = this.damping
    const uCurr = this.uCurr
    const uPrev = this.uPrev
    const uNext = this.uNext
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        const s = uCurr[i - 1] + uCurr[i + 1] + uCurr[i - w] + uCurr[i + w]
        uNext[i] = (s * 0.5 - uPrev[i]) * damp
      }
    }
    for (let x = 0; x < w; x++) {
      uNext[x] = 0
      uNext[(h - 1) * w + x] = 0
    }
    for (let y = 0; y < h; y++) {
      uNext[y * w] = 0
      uNext[y * w + (w - 1)] = 0
    }
    const t = this.uPrev
    this.uPrev = this.uCurr
    this.uCurr = this.uNext
    this.uNext = t
  }

  /**
   * Impulse in normalized coordinates (0–1). `strength` in arbitrary units (try 80–400).
   */
  impulse(nx: number, ny: number, strength: number): void {
    const w = this.cols
    const h = this.rows
    const ix = clamp(Math.floor(nx * (w - 2)) + 1, 1, w - 2)
    const iy = clamp(Math.floor(ny * (h - 2)) + 1, 1, h - 2)
    const i = iy * w + ix
    const u = this.uCurr
    u[i] += strength
    u[i + 1] += strength * 0.35
    u[i - 1] += strength * 0.35
    u[i + w] += strength * 0.35
    u[i - w] += strength * 0.35
  }

  clear(): void {
    this.uPrev.fill(0)
    this.uCurr.fill(0)
    this.uNext.fill(0)
  }

  /**
   * Rasterize current heightfield into `dest` rectangle in **CSS pixels** (same space as Axiom viewport).
   */
  drawInto(
    ctx: CanvasRenderingContext2D,
    destX: number,
    destY: number,
    destW: number,
    destH: number,
  ): void {
    if (typeof document === 'undefined') return
    const w = this.cols
    const h = this.rows
    const data = this.uCurr
    let peak = 1e-6
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]!)
      if (v > peak) peak = v
    }
    const img = ctx.createImageData(w, h)
    const d = img.data
    for (let i = 0; i < w * h; i++) {
      const hgt = data[i]! / peak
      const t = hgt * 0.5 + 0.5
      const j = i * 4
      d[j] = Math.floor(12 + t * 48)
      d[j + 1] = Math.floor(28 + t * 90)
      d[j + 2] = Math.floor(72 + t * 130)
      d[j + 3] = Math.floor(140 + t * 100)
    }
    if (!this.scratch) {
      this.scratch = document.createElement('canvas')
      this.scratch.width = w
      this.scratch.height = h
    }
    const sctx = this.scratch.getContext('2d')!
    sctx.putImageData(img, 0, 0)
    ctx.drawImage(this.scratch, destX, destY, destW, destH)
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
