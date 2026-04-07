/**
 * Axiom Runtime
 *
 * The Runtime owns one canvas and one scene.
 * It runs the animation loop, manages spring states, handles input events,
 * and calls the renderer each frame.
 *
 * Architecture:
 *
 *   Input events (mouse/touch)
 *       ↓
 *   Hit testing → node ID
 *       ↓
 *   Emit UIEvent → user handler
 *       ↓
 *   User calls runtime.spring(nodeId, target, config)
 *       ↓
 *   Spring state updated
 *       ↓
 *   RAF loop: step springs → compute offsets → render
 *
 * The loop is demand-driven: it only runs when springs are active.
 * When all springs settle, the loop stops until the next interaction.
 */

import { render, type NodeOffsets, type Viewport, type RenderHooks } from './renderer.js'
import { hitTest } from './hittest.js'
import { clearPretextLayoutCache } from './pretext-layout.js'
import { createNodeSpring, type NodeSpring } from './physics.js'
import type { Scene, SceneNode, SpringConfig } from './types.js'

export type UIEventType = 'click' | 'mouseenter' | 'mouseleave' | 'mousedown' | 'mouseup'
type Handler = (id: string) => void

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a scene and return a list of human-readable error strings.
 * Intended for development: call `setScene()` and check the console.
 */
export function validateScene(scene: Scene): string[] {
  const errors: string[] = []
  const seenIds = new Set<string>()

  function checkNodes(nodes: SceneNode[], path: string): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const loc = `${path}[${i}]`

      // ID
      if (!node.id || typeof node.id !== 'string') {
        errors.push(`${loc}: missing or empty "id" field`)
      } else if (seenIds.has(node.id)) {
        errors.push(`${loc}: duplicate id "${node.id}" — every node must have a unique id`)
      } else {
        seenIds.add(node.id)
      }

      const id = node.id ? `"${node.id}"` : loc

      // Opacity
      if (node.opacity !== undefined && (node.opacity < 0 || node.opacity > 1)) {
        errors.push(`${id}: opacity ${node.opacity} is out of range [0, 1]`)
      }

      // Per-type required fields
      switch (node.type) {
        case 'rect':
          if (typeof node.width !== 'number' || node.width < 0)
            errors.push(`${id} (rect): width must be a non-negative number, got ${node.width}`)
          if (typeof node.height !== 'number' || node.height < 0)
            errors.push(`${id} (rect): height must be a non-negative number, got ${node.height}`)
          break
        case 'circle':
          if (typeof node.radius !== 'number' || node.radius < 0)
            errors.push(`${id} (circle): radius must be a non-negative number, got ${node.radius}`)
          break
        case 'text':
          if (!node.content && node.content !== '')
            errors.push(`${id} (text): missing "content" field`)
          if (!node.font) errors.push(`${id} (text): missing "font" field`)
          if (!node.fill) errors.push(`${id} (text): missing "fill" field`)
          if (node.maxWidth !== undefined && node.lineHeight === undefined)
            errors.push(
              `${id} (text): "maxWidth" is set but "lineHeight" is missing — text will not wrap correctly`,
            )
          if (node.textLayout === 'pretext' && node.maxWidth === undefined)
            errors.push(`${id} (text): textLayout "pretext" requires "maxWidth" to be set`)
          break
        case 'line':
          if (typeof node.dx !== 'number')
            errors.push(`${id} (line): missing or invalid "dx" field`)
          if (typeof node.dy !== 'number')
            errors.push(`${id} (line): missing or invalid "dy" field`)
          if (!node.stroke) errors.push(`${id} (line): missing "stroke" field`)
          break
        case 'group':
          if (!Array.isArray(node.children))
            errors.push(`${id} (group): "children" must be an array`)
          if ((node.clipWidth === undefined) !== (node.clipHeight === undefined)) {
            errors.push(
              `${id} (group): "clipWidth" and "clipHeight" must both be set or both omitted`,
            )
          }
          break
        default: {
          // Unreachable via TypeScript, but reachable at runtime from LLM-generated JSON
          const unknownType = (node as Record<string, unknown>).type
          errors.push(`${loc}: unknown node type "${String(unknownType)}"`)
        }
      }

      // Recurse into children
      if (node.children?.length) {
        checkNodes(node.children, `${id}.children`)
      }
    }
  }

  if (!Array.isArray(scene.nodes)) {
    errors.push('scene.nodes must be an array')
    return errors
  }

  checkNodes(scene.nodes, 'nodes')
  return errors
}

export class Runtime {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scene: Scene
  private viewport: Viewport

  private handlers = new Map<UIEventType, Handler[]>()
  private springs = new Map<string, NodeSpring>()
  private offsets: NodeOffsets = new Map()

  private hoveredId: string | null = null
  private pressedId: string | null = null
  private rafId: number | null = null
  private lastTimestamp = 0
  private needsRender = true
  /** When set, the RAF loop keeps running and invokes the callback each frame (dt in seconds). */
  private continuous = false
  private frameCallback: ((dt: number) => void) | null = null
  private renderHooks: RenderHooks | null = null

  constructor(canvas: HTMLCanvasElement, scene: Scene) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.scene = scene
    this.viewport = this.computeViewport()

    canvas.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('mousedown', this.onMouseDown)
    canvas.addEventListener('mouseup', this.onMouseUp)
    canvas.addEventListener('click', this.onClick)
    canvas.addEventListener('mouseleave', this.onMouseLeaveCanvas)
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', this.onTouchCancel)

    this.scheduleFrame()
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  setScene(scene: Scene): void {
    const errors = validateScene(scene)
    if (errors.length > 0) {
      for (const msg of errors) console.warn(`[Axiom] ${msg}`)
    }
    this.scene = scene
    clearPretextLayoutCache()
    this.viewport = this.computeViewport()
    this.springs.clear()
    this.offsets.clear()
    this.hoveredId = null
    this.pressedId = null
    this.needsRender = true
    this.scheduleFrame()
  }

  /** Current scene reference — safe to mutate when driving animation; pair with `setFrameCallback`. */
  getScene(): Scene {
    return this.scene
  }

  /** Topmost interactive node at canvas coordinates (CSS px), accounting for spring offsets. */
  hitTestAt(px: number, py: number): string | null {
    return hitTest(this.scene.nodes, this.offsets, px, py)
  }

  /**
   * Run `fn` every animation frame with delta time in seconds. Enables continuous RAF
   * until cleared (`null`). Mutate `getScene()` in place for layout animations; do not
   * call `setScene` each tick (that resets springs and clears Pretext caches).
   */
  setFrameCallback(fn: ((dt: number) => void) | null): void {
    this.frameCallback = fn
    this.continuous = fn !== null
    if (fn) this.scheduleFrame()
  }

  /**
   * Optional hooks passed to the renderer (e.g. `afterBackground` for CPU ripple under UI nodes).
   */
  setRenderHooks(hooks: RenderHooks | null): void {
    this.renderHooks = hooks
    this.needsRender = true
    this.scheduleFrame()
  }

  /**
   * Register a handler for a UI event type.
   * The handler receives the ID of the node that triggered the event.
   */
  on(event: UIEventType, handler: Handler): void {
    const existing = this.handlers.get(event) ?? []
    this.handlers.set(event, [...existing, handler])
  }

  /**
   * Animate a node toward a target offset using spring physics.
   *
   * target.dx: target x displacement from the node's base position
   * target.dy: target y displacement from the node's base position
   *
   * Setting target.dy = -10 with stiffness=300 makes a card spring 10px upward.
   * Setting target.dy = 0 releases it back to its original position.
   */
  spring(nodeId: string, target: { dx?: number; dy?: number }, config?: SpringConfig): void {
    let ns = this.springs.get(nodeId)

    if (!ns) {
      const cfg = config ?? { stiffness: 200, damping: 20 }
      ns = createNodeSpring(cfg)
      this.springs.set(nodeId, ns)
    }

    if (config) {
      ns.dx.configure(config)
      ns.dy.configure(config)
      ns.config = config
    }

    if (target.dx !== undefined) ns.dx.setTarget(target.dx)
    if (target.dy !== undefined) ns.dy.setTarget(target.dy)

    this.scheduleFrame()
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.frameCallback = null
    this.continuous = false
    this.renderHooks = null
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('click', this.onClick)
    this.canvas.removeEventListener('mouseleave', this.onMouseLeaveCanvas)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.onTouchCancel)
  }

  // ─── Animation loop ──────────────────────────────────────────────────────────

  private scheduleFrame(): void {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop)
    }
  }

  private loop = (timestamp: number): void => {
    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05) // cap at 50ms
    this.lastTimestamp = timestamp

    this.frameCallback?.(dt)

    // Step all springs and collect their current positions
    let anyActive = false
    for (const [id, ns] of this.springs) {
      const dxActive = ns.dx.step(dt)
      const dyActive = ns.dy.step(dt)
      if (dxActive || dyActive) anyActive = true
      this.offsets.set(id, { dx: ns.dx.position, dy: ns.dy.position })
    }

    // Render if springs are moving, scene changed, or per-frame animation
    if (anyActive || this.needsRender || this.continuous) {
      render(this.ctx, this.scene, this.offsets, this.viewport, this.renderHooks ?? undefined)
      this.needsRender = false
    }

    if (anyActive || this.continuous) {
      this.rafId = requestAnimationFrame(this.loop)
    } else {
      this.rafId = null
    }
  }

  // ─── Input events ────────────────────────────────────────────────────────────

  // Convert a MouseEvent to CSS pixel coordinates, accounting for DPR and canvas offset.
  private getCanvasPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    const { x, y } = this.getCanvasPos(e)
    const id = hitTest(this.scene.nodes, this.offsets, x, y)

    if (id !== this.hoveredId) {
      if (this.hoveredId) {
        this.emit('mouseleave', this.hoveredId)
        this.canvas.style.cursor = 'default'
      }
      if (id) {
        this.emit('mouseenter', id)
        const node = findNode(this.scene.nodes, id)
        if (node?.cursor) this.canvas.style.cursor = node.cursor
      }
      this.hoveredId = id
    }
  }

  private onMouseDown = (e: MouseEvent): void => {
    const { x, y } = this.getCanvasPos(e)
    const id = hitTest(this.scene.nodes, this.offsets, x, y)
    if (id) {
      this.pressedId = id
      this.emit('mousedown', id)
    }
  }

  private onMouseUp = (): void => {
    if (this.pressedId) {
      this.emit('mouseup', this.pressedId)
      this.pressedId = null
    }
  }

  private onMouseLeaveCanvas = (): void => {
    if (this.hoveredId) {
      this.emit('mouseleave', this.hoveredId)
      this.hoveredId = null
      this.canvas.style.cursor = 'default'
    }
    if (this.pressedId) {
      this.emit('mouseup', this.pressedId)
      this.pressedId = null
    }
  }

  private onClick = (e: MouseEvent): void => {
    const { x, y } = this.getCanvasPos(e)
    const id = hitTest(this.scene.nodes, this.offsets, x, y)
    if (id) this.emit('click', id)
  }

  // ─── Touch events ────────────────────────────────────────────────────────────

  // Convert a Touch to CSS pixel coordinates, same space as getCanvasPos.
  private getTouchPos(touch: Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    }
  }

  private onTouchStart = (e: TouchEvent): void => {
    const touch = e.changedTouches[0]
    if (!touch) return
    const { x, y } = this.getTouchPos(touch)
    const id = hitTest(this.scene.nodes, this.offsets, x, y)
    if (id) {
      // Prevent scroll only when a UI node is hit, so non-interactive areas still scroll.
      e.preventDefault()
      if (id !== this.hoveredId) {
        if (this.hoveredId) this.emit('mouseleave', this.hoveredId)
        this.emit('mouseenter', id)
        const node = findNode(this.scene.nodes, id)
        if (node?.cursor) this.canvas.style.cursor = node.cursor
        this.hoveredId = id
      }
      this.pressedId = id
      this.emit('mousedown', id)
    }
  }

  private onTouchMove = (e: TouchEvent): void => {
    const touch = e.changedTouches[0]
    if (!touch) return
    const { x, y } = this.getTouchPos(touch)
    const id = hitTest(this.scene.nodes, this.offsets, x, y)
    if (id) e.preventDefault()
    if (id !== this.hoveredId) {
      if (this.hoveredId) {
        this.emit('mouseleave', this.hoveredId)
        this.canvas.style.cursor = 'default'
      }
      if (id) {
        this.emit('mouseenter', id)
        const node = findNode(this.scene.nodes, id)
        if (node?.cursor) this.canvas.style.cursor = node.cursor
      }
      this.hoveredId = id
    }
  }

  private onTouchEnd = (e: TouchEvent): void => {
    const touch = e.changedTouches[0]
    if (!touch) return
    const { x, y } = this.getTouchPos(touch)
    const id = hitTest(this.scene.nodes, this.offsets, x, y)
    if (this.pressedId) {
      e.preventDefault()
      this.emit('mouseup', this.pressedId)
      // Fire click only if the finger lifted over the same node it pressed
      if (id === this.pressedId) this.emit('click', this.pressedId)
      this.pressedId = null
    }
    // Clear hover on touch end (no hover state on mobile)
    if (this.hoveredId) {
      this.emit('mouseleave', this.hoveredId)
      this.hoveredId = null
      this.canvas.style.cursor = 'default'
    }
  }

  private onTouchCancel = (): void => {
    if (this.pressedId) {
      this.emit('mouseup', this.pressedId)
      this.pressedId = null
    }
    if (this.hoveredId) {
      this.emit('mouseleave', this.hoveredId)
      this.hoveredId = null
      this.canvas.style.cursor = 'default'
    }
  }

  private emit(event: UIEventType, id: string): void {
    for (const h of this.handlers.get(event) ?? []) h(id)
  }

  private computeViewport(): Viewport {
    const dpr = window.devicePixelRatio ?? 1
    return {
      width: this.canvas.width / dpr,
      height: this.canvas.height / dpr,
    }
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function findNode(nodes: SceneNode[], id: string): SceneNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}
