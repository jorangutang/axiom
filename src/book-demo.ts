/**
 * Axiom Book Demo
 *
 * A physically-realistic page-flip book rendered entirely on Canvas 2D.
 * No CSS layout. No DOM elements beyond a single <canvas>. Pure mathematics.
 *
 * Physics systems:
 *   1. Page flip spring       — Hooke's law drives foldX forward (next spread) or back (prev)
 *   2. Flip momentum          — drag velocity carries through on release
 *   3. Bezier-curved fold     — real paper doesn't fold in a straight line
 *   4. Corner curl spring     — bottom-right / bottom-left hover lifts the corner
 *   5. Particle system        — Newtonian: gravity + air resistance, paper dust on flip
 *   6. Live diagram spring    — interior page shows a spring mass oscillating in real time
 *   7. Ambient sine-wave bob  — the whole book breathes at ~0.65 Hz
 *   8. Shadow physics         — shadow spreads and shifts as book rises in the bob
 *
 * Rendering techniques:
 *   - Bezier clip paths for front/back faces of the turning leaf
 *   - Canvas transform() for perspective compression of back face
 *   - Mirror transform for back-face content (the other side of the page)
 *   - Curved gradient for fold shadow/highlight
 *   - Page stack illusion on the right spine
 *   - Top-of-page ambient light gradient on each page surface
 *   - Vignette overlay over the whole scene
 */

import { Spring } from './physics.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number // seconds remaining
  maxLife: number
  radius: number
}

type FlipState = {
  /** Forward: turn right page (next spread). Backward: turn left page (prev spread). */
  direction: 'forward' | 'backward'
  phase: 'drag' | 'spring'
  foldX: number // forward: [SPINE_X, SPINE_X+PAGE_W]. backward: [BOOK_X, SPINE_X]
  curvature: number // bezier bulge at midpoint (px). Forward: curves right; backward: curves left.
  velocity: number // drag velocity px/s — carried into spring on release
  spring: Spring // drives foldX during phase='spring'
  fromSpread: number
  toSpread: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_SPREADS = 3

// ─── BookDemo ────────────────────────────────────────────────────────────────

export class BookDemo {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private vw: number
  private vh: number
  private dpr: number

  // Fixed layout (computed once from viewport)
  private readonly PAGE_W: number
  private readonly PAGE_H: number
  private readonly BOOK_X: number // left edge of left page
  private readonly BASE_BOOK_Y: number
  private readonly SPINE_X: number // center of book, left edge of right page

  // State
  private currentSpread = 0
  private bookY = 0 // updated each frame: BASE_BOOK_Y + entrance + bob

  // Springs
  private revealSpring = new Spring({ stiffness: 55, damping: 14 })
  private cornerCurl = new Spring({ stiffness: 280, damping: 22 })
  private diagramSpring = new Spring({ stiffness: 140, damping: 10 })

  // Flip
  private flip: FlipState | null = null
  private isDragging = false
  private dragLastX = 0
  private dragLastTime = 0
  private isCornerHovered = false
  /** Bottom-left of left page — preview curl when turning backward */
  private isCornerHoveredBack = false

  // Particles
  private particles: Particle[] = []

  // Timing
  private elapsed = 0
  private lastTime = 0
  private dt = 0

  // FPS
  private fpsFrames = 0
  private fpsLastTime = 0
  private fps = 60

  private rafId: number | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.dpr = window.devicePixelRatio ?? 1
    this.ctx = canvas.getContext('2d')!
    this.vw = canvas.width / this.dpr
    this.vh = canvas.height / this.dpr

    // Layout: book fills ~52% of viewport width with a golden-ish page ratio
    this.PAGE_W = Math.min(360, Math.floor(this.vw * 0.26))
    this.PAGE_H = Math.floor(this.PAGE_W * 1.42)
    this.BOOK_X = Math.floor((this.vw - this.PAGE_W * 2) / 2)
    this.BASE_BOOK_Y = Math.floor((this.vh - this.PAGE_H) / 2)
    this.SPINE_X = this.BOOK_X + this.PAGE_W
    this.bookY = this.BASE_BOOK_Y

    // Entrance animation: book slides up from below
    this.revealSpring.snap(80)
    this.revealSpring.setTarget(0)

    // Diagram spring starts slightly displaced to immediately begin oscillating
    this.diagramSpring.position = 0.85

    this.bindEvents()
  }

  start(): void {
    this.fpsLastTime = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.unbindEvents()
  }

  // ─── Main loop ────────────────────────────────────────────────────────────

  private loop = (timestamp: number): void => {
    if (this.lastTime === 0) this.lastTime = timestamp
    this.dt = Math.min((timestamp - this.lastTime) / 1000, 0.05)
    this.lastTime = timestamp
    this.elapsed += this.dt

    // FPS: count frames, sample every 500ms
    this.fpsFrames++
    if (timestamp - this.fpsLastTime >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / (timestamp - this.fpsLastTime))
      this.fpsFrames = 0
      this.fpsLastTime = timestamp
    }

    this.updatePhysics()
    this.render()
    this.rafId = requestAnimationFrame(this.loop)
  }

  // ─── Physics update ───────────────────────────────────────────────────────

  private updatePhysics(): void {
    const { dt } = this

    // Entrance reveal + ambient sine-wave bob
    this.revealSpring.step(dt)
    const bob = Math.sin(this.elapsed * 0.65) * 3
    this.bookY = this.BASE_BOOK_Y + this.revealSpring.position + bob

    // Corner curl (forward: bottom-right; backward: bottom-left)
    const curlForward = this.isCornerHovered && !this.flip && this.currentSpread < TOTAL_SPREADS - 1
    const curlBackward = this.isCornerHoveredBack && !this.flip && this.currentSpread > 0
    const curlTarget = curlForward || curlBackward ? 24 : 0
    this.cornerCurl.setTarget(curlTarget)
    this.cornerCurl.step(dt)

    // Diagram spring — kicks itself to maintain oscillation
    this.diagramSpring.step(dt)
    if (this.diagramSpring.isSettled && Math.random() < dt * 0.35) {
      this.diagramSpring.velocity = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5)
    }

    // Flip spring
    if (this.flip?.phase === 'spring') {
      const active = this.flip.spring.step(dt)
      this.flip.foldX = this.flip.spring.position
      // Curvature decays exponentially as the spring settles
      this.flip.curvature *= Math.pow(0.8, dt * 60)

      if (!active) {
        // Flip complete
        if (this.flip.toSpread !== this.flip.fromSpread) {
          this.currentSpread = this.flip.toSpread
          this.spawnParticles(this.flip.foldX, this.bookY + this.PAGE_H * 0.5)
        }
        this.flip = null
      }
    }

    // Particles: gravity (200 px/s²) + horizontal air resistance
    for (const p of this.particles) {
      p.vy += 200 * dt
      p.vx *= Math.pow(0.55, dt)
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private render(): void {
    const { PAGE_W, PAGE_H, BOOK_X, SPINE_X } = this
    const bookY = this.bookY

    this.drawBackground()
    this.drawBookShadow(bookY)
    this.drawPageStack(bookY)

    if (this.flip) {
      // Underlay: spread we're revealing underneath, then the static half of the current spread
      if (this.flip.direction === 'forward') {
        this.drawPage(BOOK_X, bookY, 'left', this.flip.fromSpread)
        this.drawPage(SPINE_X, bookY, 'right', this.flip.toSpread)
      } else {
        this.drawPage(BOOK_X, bookY, 'left', this.flip.toSpread)
        this.drawPage(SPINE_X, bookY, 'right', this.flip.fromSpread)
      }
      // The turning leaf: back face → front face → shadow
      this.drawBackFace(this.flip, bookY)
      this.drawFrontFace(this.flip, bookY)
      this.drawFoldShadow(this.flip, bookY)
    } else {
      this.drawPage(BOOK_X, bookY, 'left', this.currentSpread)
      this.drawPage(SPINE_X, bookY, 'right', this.currentSpread)
    }

    // Spine line
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(80,50,20,0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(SPINE_X, bookY)
    ctx.lineTo(SPINE_X, bookY + PAGE_H)
    ctx.stroke()
    ctx.restore()

    // Book border
    ctx.save()
    ctx.strokeStyle = 'rgba(70,40,15,0.4)'
    ctx.lineWidth = 1
    ctx.strokeRect(BOOK_X, bookY, PAGE_W * 2, PAGE_H)
    ctx.restore()

    // Corner curl (only when not flipping)
    if (!this.flip && this.cornerCurl.position > 0.5) {
      if (this.isCornerHovered && this.currentSpread < TOTAL_SPREADS - 1) {
        this.drawCornerCurl(SPINE_X + PAGE_W, bookY + PAGE_H, 1)
      }
      if (this.isCornerHoveredBack && this.currentSpread > 0) {
        this.drawCornerCurl(BOOK_X, bookY + PAGE_H, -1)
      }
    }

    this.drawParticles()
    this.drawVignette()
    this.drawHints(bookY)
    this.drawProgressDots(bookY)
    this.drawFPS()
  }

  // ─── Background ───────────────────────────────────────────────────────────

  private drawBackground(): void {
    const { ctx, vw, vh } = this
    // Warm wooden desk: radial gradient, lighter at center
    const g = ctx.createRadialGradient(
      vw * 0.5,
      vh * 0.45,
      0,
      vw * 0.5,
      vh * 0.45,
      Math.max(vw, vh) * 0.75,
    )
    g.addColorStop(0, '#261B0C')
    g.addColorStop(0.5, '#1B1106')
    g.addColorStop(1, '#0D0904')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, vw, vh)

    // Wood grain: subtle bezier lines
    ctx.save()
    ctx.globalAlpha = 0.022
    for (let i = 0; i < 14; i++) {
      const y = vh * (i / 14)
      const dy = Math.sin(i * 0.9) * 12
      ctx.strokeStyle = i % 3 === 0 ? '#7A4820' : '#3A2010'
      ctx.lineWidth = 0.4 + Math.abs(Math.sin(i * 1.4)) * 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(vw * 0.33, y + dy, vw * 0.66, y - dy * 0.7, vw, y + dy * 0.4)
      ctx.stroke()
    }
    ctx.restore()
  }

  // ─── Book shadow ──────────────────────────────────────────────────────────

  private drawBookShadow(bookY: number): void {
    const { ctx, PAGE_W, PAGE_H, BOOK_X, BASE_BOOK_Y } = this
    // The bob lifts the book above its rest position; shadow responds:
    // higher book → shadow spreads wider, shifts down, lightens slightly
    const lift = Math.max(0, BASE_BOOK_Y - bookY + 3) // positive when above rest
    const spread = 12 + lift * 1.8
    const offsetY = 8 + lift * 1.2
    const blurSize = 20 + lift * 1.0
    const alpha = 0.58 - lift * 0.008

    ctx.save()
    ctx.filter = `blur(${blurSize}px)`
    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    // Elongated shadow ellipse below the book
    ctx.beginPath()
    ctx.ellipse(
      BOOK_X + PAGE_W,
      bookY + PAGE_H + offsetY,
      PAGE_W + spread,
      10 + lift * 0.5,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.filter = 'none'
    ctx.restore()
  }

  // ─── Page stack ───────────────────────────────────────────────────────────

  private drawPageStack(bookY: number): void {
    const { ctx, PAGE_H, PAGE_W, SPINE_X } = this
    ctx.save()
    // Stacked page edges on the right side of the right page
    for (let i = 8; i >= 0; i--) {
      const off = i * 0.65
      const shade = 235 - i * 6
      ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 20})`
      ctx.fillRect(SPINE_X + PAGE_W + off, bookY + 1, 1.5, PAGE_H - 2)
    }
    ctx.restore()
  }

  // ─── Complete page (fill + content + clip) ────────────────────────────────

  private drawPage(x: number, bookY: number, side: 'left' | 'right', spread: number): void {
    const { PAGE_W, PAGE_H } = this
    this.drawPageFill(x, bookY, side)
    this.drawPageContent(x, bookY, side, spread)
    if (spread > 0) {
      const pageNum = side === 'left' ? spread * 2 - 1 : spread * 2
      this.drawPageNumber(x, bookY, pageNum)
    }
  }

  // ─── Page fill ────────────────────────────────────────────────────────────

  private drawPageFill(x: number, bookY: number, side: 'left' | 'right'): void {
    const { ctx, PAGE_W, PAGE_H } = this

    ctx.fillStyle = side === 'left' ? '#F6F0E5' : '#F2ECE1'
    ctx.fillRect(x, bookY, PAGE_W, PAGE_H)

    // Ambient top-light gradient (simulates light source above)
    const lightG = ctx.createLinearGradient(x, bookY, x, bookY + PAGE_H * 0.45)
    lightG.addColorStop(0, 'rgba(255,250,240,0.20)')
    lightG.addColorStop(0.5, 'rgba(255,250,240,0.04)')
    lightG.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lightG
    ctx.fillRect(x, bookY, PAGE_W, PAGE_H)

    // Spine-side inner shadow (pages are darker near the binding)
    const spineG =
      side === 'left'
        ? ctx.createLinearGradient(x + PAGE_W - 20, 0, x + PAGE_W, 0)
        : ctx.createLinearGradient(x, 0, x + 20, 0)
    spineG.addColorStop(0, 'rgba(0,0,0,0)')
    spineG.addColorStop(1, 'rgba(35,18,4,0.14)')
    ctx.fillStyle = spineG
    ctx.fillRect(x, bookY, PAGE_W, PAGE_H)
  }

  // ─── Page content ─────────────────────────────────────────────────────────

  private drawPageContent(x: number, bookY: number, side: 'left' | 'right', spread: number): void {
    const { ctx, PAGE_W, PAGE_H } = this

    // Content area margins
    const mInner = 30 // toward spine
    const mOuter = 38 // away from spine
    const mTop = 38
    const mBot = 44

    const cx = side === 'left' ? x + mOuter : x + mInner
    const cy = bookY + mTop
    const cw = PAGE_W - mInner - mOuter
    const ch = PAGE_H - mTop - mBot

    ctx.save()
    ctx.beginPath()
    ctx.rect(x, bookY, PAGE_W, PAGE_H)
    ctx.clip()

    switch (spread) {
      case 0:
        this.contentSpread0(ctx, side, cx, cy, cw, ch)
        break
      case 1:
        this.contentSpread1(ctx, side, cx, cy, cw, ch, x, bookY, PAGE_W, PAGE_H)
        break
      case 2:
        this.contentSpread2(ctx, side, cx, cy, cw, ch, x, bookY, PAGE_W, PAGE_H)
        break
    }

    ctx.restore()
  }

  private drawPageNumber(x: number, bookY: number, num: number): void {
    const { ctx, PAGE_W, PAGE_H } = this
    ctx.save()
    ctx.font = '400 10px Georgia, serif'
    ctx.fillStyle = '#8B7355'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.beginPath()
    ctx.rect(x, bookY, PAGE_W, PAGE_H)
    ctx.clip()
    ctx.fillText(String(num), x + PAGE_W / 2, bookY + PAGE_H - 14)
    ctx.restore()
  }

  // ─── Spread content definitions ───────────────────────────────────────────

  // Spread 0: Title spread
  private contentSpread0(
    ctx: CanvasRenderingContext2D,
    side: string,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
  ): void {
    if (side === 'left') {
      // Back of cover — decorative only
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '300 44px Georgia, serif'
      ctx.fillStyle = 'rgba(100,70,40,0.12)'
      ctx.fillText('~', cx + cw / 2, cy + ch / 2 - 16)
      ctx.font = '300 9px Georgia, "Times New Roman", serif'
      ctx.fillStyle = 'rgba(100,70,40,0.22)'
      ctx.letterSpacing = '3px'
      ctx.fillText('AXIOM', cx + cw / 2, cy + ch / 2 + 16)
      ctx.letterSpacing = '0px'
    } else {
      // Title page
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      this.drawHRule(ctx, cx, cy + ch * 0.1, cw, 'rgba(110,80,44,0.3)')

      ctx.font = '700 26px Georgia, serif'
      ctx.fillStyle = '#180E06'
      ctx.fillText('AXIOM', cx + cw / 2, cy + ch * 0.16)

      this.drawHRule(ctx, cx, cy + ch * 0.3, cw, 'rgba(110,80,44,0.22)')

      ctx.font = '400 italic 11px Georgia, serif'
      ctx.fillStyle = '#6B4E32'
      ctx.fillText('A New Physics for', cx + cw / 2, cy + ch * 0.34)
      ctx.fillText('Human Interfaces', cx + cw / 2, cy + ch * 0.34 + 18)

      this.drawHRule(ctx, cx + cw * 0.2, cy + ch * 0.5, cw * 0.6, 'rgba(110,80,44,0.15)')

      ctx.font = '400 10px Georgia, serif'
      ctx.fillStyle = '#8B7355'
      ctx.fillText('Jesse & Claude', cx + cw / 2, cy + ch * 0.7)
      ctx.fillText('MMXXVI', cx + cw / 2, cy + ch * 0.7 + 18)

      this.drawHRule(ctx, cx, cy + ch * 0.88, cw, 'rgba(110,80,44,0.3)')
    }
  }

  // Spread 1: The Coordinate
  private contentSpread1(
    ctx: CanvasRenderingContext2D,
    side: string,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    px: number,
    bookY: number,
    pw: number,
    ph: number,
  ): void {
    if (side === 'left') {
      this.drawChapter(ctx, cx, cy, cw, 'I.', 'The Coordinate', [
        'The fundamental unit of an Axiom interface is not a component, not a class name — it is a coordinate. A point in two-dimensional space, precisely located.',
        'When you place an element at (240, 160), it is there. Not after a layout engine processes your flex rules. Not approximately. Exactly.',
        'This precision enables something the web has never had: an interface you can reason about mathematically. Every position is a number you wrote. Every relationship is an equation you solved.',
        'The browser\u2019s job is reduced: receive events, run JavaScript, draw pixels. No layout engine. No cascade. No surprises.',
      ])
    } else {
      this.drawCoordinateDiagram(ctx, cx, cy, cw, ch)
    }
  }

  // Spread 2: The Spring
  private contentSpread2(
    ctx: CanvasRenderingContext2D,
    side: string,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    px: number,
    bookY: number,
    pw: number,
    ph: number,
  ): void {
    if (side === 'left') {
      this.drawChapter(ctx, cx, cy, cw, 'II.', 'The Spring', [
        "A spring is defined by three numbers: stiffness k, damping b, and mass m. These govern the entirety of an element's motion from force to rest.",
        '',
        'F  =  −kx − bv',
        '',
        'Where x is displacement and v is velocity. The result is motion that feels inevitable — as if the element has weight and truly wants to settle.',
        'Change the target mid-animation and the spring continues from its current velocity. No jarring restart. No hard-coded duration. Physics decides when it stops.',
      ])
    } else {
      this.drawSpringDiagram(ctx, cx, cy, cw, ch)
    }
  }

  // ─── Chapter layout helper ────────────────────────────────────────────────

  private drawChapter(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    cw: number,
    num: string,
    title: string,
    paras: string[],
  ): void {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    ctx.font = '400 9px Georgia, serif'
    ctx.fillStyle = '#8B7355'
    ctx.fillText(num, cx, cy)

    this.drawHRule(ctx, cx, cy + 15, cw, 'rgba(110,80,44,0.22)')

    ctx.font = '700 15px Georgia, serif'
    ctx.fillStyle = '#180E06'
    ctx.fillText(title, cx, cy + 22)

    let y = cy + 48
    for (const para of paras) {
      if (!para) {
        y += 10
        continue
      }

      if (para.includes('=') && para.length < 24) {
        // Math equation: render centered, italic
        ctx.font = '400 italic 13px Georgia, serif'
        ctx.fillStyle = '#3A2010'
        ctx.textAlign = 'center'
        ctx.fillText(para, cx + cw / 2, y)
        ctx.textAlign = 'left'
        y += 28
      } else {
        ctx.font = '400 13px Georgia, serif'
        ctx.fillStyle = '#2A1A0C'
        y = this.wrapText(ctx, para, cx, y, cw, 20) + 12
      }
    }
  }

  // ─── Coordinate diagram (live, spread 1 right) ───────────────────────────

  private drawCoordinateDiagram(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
  ): void {
    const ox = cx + cw * 0.5 // origin x
    const oy = cy + ch * 0.46 // origin y
    const len = Math.min(cw, ch) * 0.43

    ctx.save()
    ctx.strokeStyle = '#3A2010'
    ctx.fillStyle = '#3A2010'
    ctx.lineWidth = 1

    // X axis + arrow
    ctx.beginPath()
    ctx.moveTo(ox - len, oy)
    ctx.lineTo(ox + len, oy)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ox + len, oy)
    ctx.lineTo(ox + len - 6, oy - 3.5)
    ctx.lineTo(ox + len - 6, oy + 3.5)
    ctx.fill()

    // Y axis + arrow
    ctx.beginPath()
    ctx.moveTo(ox, oy + len)
    ctx.lineTo(ox, oy - len)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ox, oy - len)
    ctx.lineTo(ox - 3.5, oy - len + 6)
    ctx.lineTo(ox + 3.5, oy - len + 6)
    ctx.fill()

    // Axis labels
    ctx.font = '400 9px Georgia, serif'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    ctx.fillText('x', ox + len + 3, oy + 4)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText('y', ox - 6, oy - len + 2)

    // Animated sine curve (phase driven by elapsed time)
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    for (let i = 0; i <= 80; i++) {
      const t = i / 80
      const px = ox - len + t * len * 2
      const py = oy - Math.sin(t * Math.PI * 2.4 + this.elapsed * 1.6) * len * 0.44
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.stroke()

    // Fixed scatter points
    const pts: [number, number][] = [
      [0.28, 0.62],
      [-0.52, -0.38],
      [0.72, 0.78],
      [-0.38, 0.44],
      [0.55, -0.51],
    ]
    ctx.fillStyle = '#C0501A'
    for (const [px, py] of pts) {
      ctx.beginPath()
      ctx.arc(ox + px * len, oy - py * len, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Caption
    ctx.font = '400 italic 10px Georgia, serif'
    ctx.fillStyle = '#8B7355'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('every element is a point in this space', ox, cy + ch * 0.85)

    ctx.restore()
  }

  // ─── Spring diagram (live, spread 2 right) ───────────────────────────────

  private drawSpringDiagram(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
  ): void {
    const anchorX = cx + cw * 0.5
    const anchorY = cy + ch * 0.08
    const equilibY = cy + ch * 0.55
    const massR = 16

    // Mass displacement: spring drives it, scaled to pixels
    const massOffset = this.diagramSpring.position * (ch * 0.2)
    const massY = equilibY + massOffset

    ctx.save()

    // Ceiling mount
    ctx.fillStyle = '#3A2010'
    ctx.fillRect(anchorX - 22, anchorY - 7, 44, 7)

    // Spring coils: zigzag from anchor to mass
    const COILS = 9
    const coilR = 14
    const springTop = anchorY
    const springBot = massY - massR

    ctx.strokeStyle = '#6B4E32'
    ctx.lineWidth = 1.4
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(anchorX, springTop)
    const steps = COILS * 4
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const sy = springTop + t * (springBot - springTop)
      // Zigzag: alternate left/right at each quarter coil
      const side = Math.sin((i * Math.PI) / 2)
      ctx.lineTo(anchorX + side * coilR, sy)
    }
    ctx.lineTo(anchorX, springBot)
    ctx.stroke()

    // Mass: circle whose color reflects tension
    const tension = Math.abs(massOffset) / (ch * 0.2)
    const hue = 20 + tension * 12
    const sat = 55 + tension * 25
    const lit = 36 - tension * 8

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`
    ctx.beginPath()
    ctx.arc(anchorX, massY, massR, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(anchorX, massY, massR, 0, Math.PI * 2)
    ctx.stroke()

    // Equilibrium dashed line
    ctx.strokeStyle = 'rgba(110,80,44,0.28)'
    ctx.lineWidth = 0.8
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(anchorX - 32, equilibY)
    ctx.lineTo(anchorX + 32, equilibY)
    ctx.stroke()
    ctx.setLineDash([])

    // Velocity arrow on the mass
    const vel = this.diagramSpring.velocity
    if (Math.abs(vel) > 0.04) {
      const arrowLen = Math.min(Math.abs(vel) * 38, 26)
      const dir = vel > 0 ? 1 : -1
      const arrowX = anchorX + massR + 6
      ctx.strokeStyle = '#C04010'
      ctx.fillStyle = '#C04010'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(arrowX, massY)
      ctx.lineTo(arrowX + arrowLen * dir, massY)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(arrowX + arrowLen * dir, massY)
      ctx.lineTo(arrowX + (arrowLen - 5) * dir, massY - 3)
      ctx.lineTo(arrowX + (arrowLen - 5) * dir, massY + 3)
      ctx.fill()

      // Velocity label
      ctx.font = '400 9px Georgia, serif'
      ctx.fillStyle = '#C04010'
      ctx.textAlign = dir > 0 ? 'left' : 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText('v', arrowX + arrowLen * dir + dir * 3, massY - 1)
    }

    // Parameter labels
    ctx.font = '400 italic 9px Georgia, serif'
    ctx.fillStyle = '#8B7355'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const labelX = anchorX - coilR - 6
    ctx.fillText('k = 140', labelX, anchorY + (equilibY - anchorY) * 0.28)
    ctx.fillText('b = 10', labelX, anchorY + (equilibY - anchorY) * 0.52)
    ctx.fillText('m = 1', labelX, anchorY + (equilibY - anchorY) * 0.72)

    // Caption
    ctx.font = '400 italic 10px Georgia, serif'
    ctx.fillStyle = '#8B7355'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('F = −kx − bv', anchorX, cy + ch * 0.83)
    ctx.fillText('live spring — always oscillating', anchorX, cy + ch * 0.83 + 15)

    ctx.restore()
  }

  // ─── Flip: back face ──────────────────────────────────────────────────────
  //
  // The back face is the UNDERSIDE of the turning leaf.
  // It shows the left page of the destination spread, compressed + mirrored.
  //
  // Transform: srcX=SPINE_X → destX=foldX,  srcX=SPINE_X+PAGE_W → destX=SPINE_X
  // This is: destX = foldX + SPINE_X * compressionRatio − srcX * compressionRatio
  //        = −compressionRatio * srcX + (foldX + SPINE_X * compressionRatio)
  //
  private drawBackFace(flip: FlipState, bookY: number): void {
    const { ctx, PAGE_W, PAGE_H, SPINE_X } = this
    const { foldX, curvature } = flip

    // Same affine map for both directions: ratio = (foldX - SPINE_X) / PAGE_W
    // Forward: foldX > SPINE_X (ratio > 0). Backward: foldX < SPINE_X (ratio < 0).
    const ratio = (foldX - SPINE_X) / PAGE_W
    const backW = Math.abs(foldX - SPINE_X)
    if (backW < 1) return

    if (flip.direction === 'forward') {
      // Clip: spine → fold curve (turning right page)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(SPINE_X, bookY)
      ctx.lineTo(foldX, bookY)
      ctx.quadraticCurveTo(foldX + curvature, bookY + PAGE_H / 2, foldX, bookY + PAGE_H)
      ctx.lineTo(SPINE_X, bookY + PAGE_H)
      ctx.closePath()
      ctx.clip()

      ctx.transform(-ratio, 0, 0, 1, foldX + SPINE_X * ratio, 0)

      this.drawPageFill(SPINE_X, bookY, 'left')
      this.drawPageContent(SPINE_X, bookY, 'left', flip.toSpread)
      this.drawPageNumber(SPINE_X, bookY, flip.toSpread * 2 - 1)

      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(SPINE_X, bookY)
      ctx.lineTo(foldX, bookY)
      ctx.quadraticCurveTo(foldX + curvature, bookY + PAGE_H / 2, foldX, bookY + PAGE_H)
      ctx.lineTo(SPINE_X, bookY + PAGE_H)
      ctx.closePath()
      ctx.clip()
      ctx.fillStyle = `rgba(30,14,2,${0.07 + 0.2 * (1 - ratio)})`
      ctx.fillRect(SPINE_X, bookY, foldX - SPINE_X, PAGE_H)
      ctx.restore()
    } else {
      // Backward: underside shows destination spread's right page (verso of left leaf)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(foldX, bookY)
      ctx.quadraticCurveTo(foldX + curvature, bookY + PAGE_H / 2, foldX, bookY + PAGE_H)
      ctx.lineTo(SPINE_X, bookY + PAGE_H)
      ctx.lineTo(SPINE_X, bookY)
      ctx.closePath()
      ctx.clip()

      ctx.transform(-ratio, 0, 0, 1, foldX + SPINE_X * ratio, 0)

      this.drawPageFill(SPINE_X, bookY, 'right')
      this.drawPageContent(SPINE_X, bookY, 'right', flip.toSpread)
      if (flip.toSpread > 0) this.drawPageNumber(SPINE_X, bookY, flip.toSpread * 2)

      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(foldX, bookY)
      ctx.quadraticCurveTo(foldX + curvature, bookY + PAGE_H / 2, foldX, bookY + PAGE_H)
      ctx.lineTo(SPINE_X, bookY + PAGE_H)
      ctx.lineTo(SPINE_X, bookY)
      ctx.closePath()
      ctx.clip()
      const lit = Math.abs(ratio)
      ctx.fillStyle = `rgba(30,14,2,${0.07 + 0.2 * (1 - lit)})`
      ctx.fillRect(foldX, bookY, SPINE_X - foldX, PAGE_H)
      ctx.restore()
    }
  }

  // ─── Flip: front face ─────────────────────────────────────────────────────
  //
  // The front face is the visible surface of the turning page.
  // It shows the current spread's right page, clipped to the right of the fold curve.
  //
  private drawFrontFace(flip: FlipState, bookY: number): void {
    const { ctx, PAGE_W, PAGE_H, BOOK_X, SPINE_X } = this
    const { foldX, curvature } = flip

    if (flip.direction === 'forward') {
      const frontW = SPINE_X + PAGE_W - foldX
      if (frontW < 1) return

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(foldX, bookY)
      ctx.quadraticCurveTo(foldX + curvature, bookY + PAGE_H / 2, foldX, bookY + PAGE_H)
      ctx.lineTo(SPINE_X + PAGE_W, bookY + PAGE_H)
      ctx.lineTo(SPINE_X + PAGE_W, bookY)
      ctx.closePath()
      ctx.clip()

      this.drawPageFill(SPINE_X, bookY, 'right')
      this.drawPageContent(SPINE_X, bookY, 'right', flip.fromSpread)
      if (flip.fromSpread > 0) this.drawPageNumber(SPINE_X, bookY, flip.fromSpread * 2)

      ctx.restore()
    } else {
      const visW = foldX - BOOK_X
      if (visW < 1) return

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(BOOK_X, bookY)
      ctx.lineTo(foldX, bookY)
      ctx.quadraticCurveTo(foldX + curvature, bookY + PAGE_H / 2, foldX, bookY + PAGE_H)
      ctx.lineTo(BOOK_X, bookY + PAGE_H)
      ctx.closePath()
      ctx.clip()

      const r = visW / PAGE_W
      ctx.translate(BOOK_X, 0)
      ctx.scale(r, 1)
      ctx.translate(-BOOK_X, 0)

      this.drawPageFill(BOOK_X, bookY, 'left')
      this.drawPageContent(BOOK_X, bookY, 'left', flip.fromSpread)
      if (flip.fromSpread > 0) this.drawPageNumber(BOOK_X, bookY, flip.fromSpread * 2 - 1)

      ctx.restore()
    }
  }

  // ─── Flip: fold shadow + highlight ───────────────────────────────────────

  private drawFoldShadow(flip: FlipState, bookY: number): void {
    const { ctx, PAGE_H } = this
    const { foldX, curvature, direction } = flip

    const SW = 26 // shadow half-width
    const c = direction === 'backward' ? -curvature : curvature
    const midX = foldX + c * 0.5

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(foldX - SW, bookY)
    ctx.quadraticCurveTo(foldX - SW + c * 0.5, bookY + PAGE_H / 2, foldX - SW, bookY + PAGE_H)
    ctx.lineTo(foldX + SW, bookY + PAGE_H)
    ctx.quadraticCurveTo(foldX + SW + c * 0.5, bookY + PAGE_H / 2, foldX + SW, bookY)
    ctx.closePath()

    const g = ctx.createLinearGradient(midX - SW, 0, midX + SW, 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.3, 'rgba(22,8,0,0.10)')
    g.addColorStop(0.46, 'rgba(38,12,0,0.30)')
    g.addColorStop(0.54, 'rgba(255,232,205,0.28)')
    g.addColorStop(0.68, 'rgba(200,155,90,0.06)')
    g.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()
  }

  // ─── Corner curl ─────────────────────────────────────────────────────────

  /** mirror: 1 = bottom-right corner (forward), -1 = bottom-left (backward) */
  private drawCornerCurl(cornerX: number, cornerY: number, mirror: 1 | -1): void {
    const { ctx } = this
    const sz = this.cornerCurl.position
    if (sz < 0.5) return

    const dx = mirror * sz

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 7
    ctx.shadowOffsetX = mirror === 1 ? -2 : 2
    ctx.shadowOffsetY = -3

    ctx.beginPath()
    ctx.moveTo(cornerX - dx, cornerY)
    ctx.lineTo(cornerX, cornerY - sz)
    ctx.lineTo(cornerX, cornerY)
    ctx.closePath()

    const g = ctx.createLinearGradient(cornerX - dx, cornerY, cornerX, cornerY - sz)
    g.addColorStop(0, '#EDE3D2')
    g.addColorStop(1, '#F4EDE0')
    ctx.fillStyle = g
    ctx.fill()

    ctx.restore()

    ctx.save()
    ctx.strokeStyle = 'rgba(110,80,44,0.20)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(cornerX - dx, cornerY)
    ctx.lineTo(cornerX, cornerY - sz)
    ctx.stroke()
    ctx.restore()
  }

  // ─── Particles ────────────────────────────────────────────────────────────

  private drawParticles(): void {
    const { ctx } = this
    ctx.save()
    for (const p of this.particles) {
      const life = p.life / p.maxLife // 1→0
      ctx.globalAlpha = life * 0.75
      ctx.fillStyle = 'rgba(240,218,185,1)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * (0.4 + life * 0.6), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private spawnParticles(x: number, y: number): void {
    const count = 16 + Math.floor(Math.random() * 10)
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
      const speed = 50 + Math.random() * 140
      const life = 0.5 + Math.random() * 0.8
      this.particles.push({
        x,
        y: y + (Math.random() - 0.5) * this.PAGE_H * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 20,
        life,
        maxLife: life,
        radius: 0.8 + Math.random() * 2.0,
      })
    }
  }

  // ─── Vignette ─────────────────────────────────────────────────────────────

  private drawVignette(): void {
    const { ctx, vw, vh } = this
    const g = ctx.createRadialGradient(
      vw / 2,
      vh / 2,
      vh * 0.3,
      vw / 2,
      vh / 2,
      Math.max(vw, vh) * 0.75,
    )
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.7, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, vw, vh)
  }

  // ─── Navigation hints ─────────────────────────────────────────────────────

  private drawHints(bookY: number): void {
    const { ctx, BOOK_X, SPINE_X, PAGE_W, PAGE_H } = this
    if (this.flip) return

    const pulse = 0.13 + Math.sin(this.elapsed * 2.0) * 0.07
    ctx.save()
    ctx.globalAlpha = pulse
    ctx.font = '400 10px Georgia, serif'
    ctx.fillStyle = '#5A3A1A'
    ctx.textBaseline = 'bottom'

    if (this.currentSpread < TOTAL_SPREADS - 1) {
      ctx.textAlign = 'right'
      ctx.fillText('drag → to turn page', SPINE_X + PAGE_W - 12, bookY + PAGE_H - 20)
    }
    if (this.currentSpread > 0) {
      ctx.textAlign = 'left'
      ctx.fillText('← drag to turn back', BOOK_X + 12, bookY + PAGE_H - 20)
    }
    ctx.restore()
  }

  // ─── Progress dots ────────────────────────────────────────────────────────

  private drawProgressDots(bookY: number): void {
    const { ctx, SPINE_X, PAGE_H } = this
    const dotR = 2.5
    const spacing = 10
    const totalW = (TOTAL_SPREADS - 1) * spacing
    const startX = SPINE_X - totalW / 2

    ctx.save()
    for (let i = 0; i < TOTAL_SPREADS; i++) {
      const active = i === this.currentSpread
      ctx.fillStyle = active ? 'rgba(90,60,25,0.55)' : 'rgba(90,60,25,0.18)'
      ctx.beginPath()
      ctx.arc(startX + i * spacing, bookY + PAGE_H + 28, active ? dotR : dotR * 0.7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // ─── FPS counter ──────────────────────────────────────────────────────────

  private drawFPS(): void {
    const { ctx, vw } = this
    const color = this.fps >= 50 ? '#22C55E' : this.fps >= 30 ? '#EAB308' : '#EF4444'
    ctx.save()
    ctx.font = '400 11px "SF Mono", "Menlo", "Courier New", monospace'
    ctx.fillStyle = color
    ctx.globalAlpha = 0.55
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${this.fps} fps`, vw - 14, 14)
    ctx.restore()
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private drawHRule(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    color: string,
  ): void {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.stroke()
    ctx.restore()
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh: number,
  ): number {
    const words = text.split(' ')
    let line = ''
    let curY = y
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width > maxW && line) {
        ctx.fillText(line, x, curY)
        line = word
        curY += lh
      } else {
        line = candidate
      }
    }
    if (line) {
      ctx.fillText(line, x, curY)
      curY += lh
    }
    return curY
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  private getPos(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onMouseMove = (e: MouseEvent): void => {
    const { x, y } = this.getPos(e)
    const { PAGE_W, PAGE_H, BOOK_X, SPINE_X } = this
    const bookY = this.bookY

    const distCorner = Math.hypot(x - (SPINE_X + PAGE_W), y - (bookY + PAGE_H))
    this.isCornerHovered = distCorner < 72 && this.currentSpread < TOTAL_SPREADS - 1

    const distCornerBack = Math.hypot(x - BOOK_X, y - (bookY + PAGE_H))
    this.isCornerHoveredBack = distCornerBack < 72 && this.currentSpread > 0

    if (this.isDragging && this.flip) {
      const now = performance.now()
      const dt = (now - this.dragLastTime) / 1000
      if (dt > 0) this.flip.velocity = (x - this.dragLastX) / dt
      this.flip.curvature = Math.max(-25, Math.min(25, this.flip.velocity * 0.045))
      if (this.flip.direction === 'forward') {
        this.flip.foldX = Math.max(SPINE_X, Math.min(SPINE_X + PAGE_W, x))
      } else {
        this.flip.foldX = Math.max(BOOK_X, Math.min(SPINE_X, x))
      }
      this.dragLastX = x
      this.dragLastTime = now
      this.canvas.style.cursor = 'grabbing'
    }
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (this.flip?.phase === 'spring') return

    const { x, y } = this.getPos(e)
    const { PAGE_W, PAGE_H, BOOK_X, SPINE_X } = this
    const bookY = this.bookY
    const inBook = y >= bookY && y <= bookY + PAGE_H

    const forwardZone =
      inBook &&
      this.currentSpread < TOTAL_SPREADS - 1 &&
      x >= SPINE_X + PAGE_W * 0.45 &&
      x <= SPINE_X + PAGE_W

    const backwardZone =
      inBook && this.currentSpread > 0 && x >= BOOK_X && x <= BOOK_X + PAGE_W * 0.55

    if (forwardZone) {
      this.isDragging = true
      this.dragLastX = x
      this.dragLastTime = performance.now()
      this.flip = {
        direction: 'forward',
        phase: 'drag',
        foldX: SPINE_X + PAGE_W,
        curvature: 0,
        velocity: 0,
        spring: new Spring({ stiffness: 220, damping: 26 }),
        fromSpread: this.currentSpread,
        toSpread: this.currentSpread + 1,
      }
      this.canvas.style.cursor = 'grabbing'
    } else if (backwardZone) {
      this.isDragging = true
      this.dragLastX = x
      this.dragLastTime = performance.now()
      this.flip = {
        direction: 'backward',
        phase: 'drag',
        foldX: Math.max(BOOK_X, Math.min(SPINE_X, x)),
        curvature: 0,
        velocity: 0,
        spring: new Spring({ stiffness: 220, damping: 26 }),
        fromSpread: this.currentSpread,
        toSpread: this.currentSpread - 1,
      }
      this.canvas.style.cursor = 'grabbing'
    }
  }

  private onMouseUp = (): void => {
    if (!this.isDragging || !this.flip) return
    this.isDragging = false
    this.canvas.style.cursor = 'default'

    const { BOOK_X, SPINE_X, PAGE_W } = this
    let shouldComplete: boolean
    let target: number

    if (this.flip.direction === 'forward') {
      shouldComplete = this.flip.foldX < SPINE_X + PAGE_W * 0.45 || this.flip.velocity < -140
      target = shouldComplete ? SPINE_X : SPINE_X + PAGE_W
    } else {
      shouldComplete = this.flip.foldX > BOOK_X + PAGE_W * 0.45 || this.flip.velocity > 140
      target = shouldComplete ? SPINE_X : BOOK_X
    }

    if (!shouldComplete) this.flip.toSpread = this.flip.fromSpread

    this.flip.spring.snap(this.flip.foldX)
    this.flip.spring.velocity = this.flip.velocity * 0.5
    this.flip.spring.setTarget(target)
    this.flip.phase = 'spring'
  }

  private onMouseLeave = (): void => {
    this.isCornerHovered = false
    this.isCornerHoveredBack = false
    if (this.isDragging) this.onMouseUp()
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    this.canvas.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('mouseleave', this.onMouseLeave)
  }

  private unbindEvents(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave)
  }
}
