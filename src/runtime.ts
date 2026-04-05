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

import { render, type NodeOffsets, type Viewport } from './renderer.js'
import { hitTest } from './hittest.js'
import { clearPretextLayoutCache } from './pretext-layout.js'
import { createNodeSpring, type NodeSpring } from './physics.js'
import type { Scene, SceneNode, SpringConfig } from './types.js'

export type UIEventType = 'click' | 'mouseenter' | 'mouseleave' | 'mousedown' | 'mouseup'
type Handler = (id: string) => void

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

    this.scheduleFrame()
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  setScene(scene: Scene): void {
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
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('click', this.onClick)
    this.canvas.removeEventListener('mouseleave', this.onMouseLeaveCanvas)
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
      render(this.ctx, this.scene, this.offsets, this.viewport)
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
