/**
 * Axiom Canvas Renderer
 *
 * Translates a Scene + per-node spring offsets into Canvas 2D draw calls.
 *
 * There is no layout pass. Every coordinate in the scene is already a resolved
 * pixel position. The renderer's job is purely mechanical: visit each node,
 * apply its transform and style, issue draw calls.
 *
 * The renderer is stateless. Given the same scene and offsets, it produces
 * identical output. It has no knowledge of interaction, state, or animation.
 */

import type { Scene, SceneNode, RectNode, TextNode, CircleNode, LineNode, GroupNode, Shadow } from './types.js'

// Map from node ID → current spring displacement.
// Applied additively to the node's base x, y position.
export type NodeOffsets = Map<string, { dx: number; dy: number }>

export type Viewport = { width: number; height: number }

// ─── Public entry point ───────────────────────────────────────────────────────

export function render(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  offsets: NodeOffsets,
  viewport: Viewport,
): void {
  // Clear the full canvas in device pixel space (bypassing the DPR transform)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()

  // Base background color
  if (scene.background) {
    ctx.fillStyle = scene.background
    ctx.fillRect(0, 0, viewport.width, viewport.height)
  }

  // Optional radial gradient overlay
  if (scene.backgroundGradient) {
    const g = scene.backgroundGradient
    const cx = g.cx * viewport.width
    const cy = g.cy * viewport.height
    const r  = g.r * Math.max(viewport.width, viewport.height)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, g.from)
    grad.addColorStop(1, g.to)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, viewport.width, viewport.height)
  }

  for (const node of scene.nodes) {
    renderNode(ctx, node, offsets, 0, 0)
  }
}

// ─── Node rendering ───────────────────────────────────────────────────────────

function renderNode(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  offsets: NodeOffsets,
  parentX: number,
  parentY: number,
): void {
  const off = offsets.get(node.id)
  const dx  = off?.dx ?? 0
  const dy  = off?.dy ?? 0
  const x   = parentX + node.x + dx
  const y   = parentY + node.y + dy

  ctx.save()
  if (node.opacity !== undefined) ctx.globalAlpha *= node.opacity

  switch (node.type) {
    case 'rect':   renderRect(ctx, x, y, node, dy);  break
    case 'text':   renderText(ctx, x, y, node);       break
    case 'circle': renderCircle(ctx, x, y, node);     break
    case 'line':   renderLine(ctx, x, y, node);       break
    case 'group':  renderGroup(ctx, x, y, node, offsets); break
  }

  // Render children for all node types (children use parent's rendered position)
  if (node.type !== 'group' && node.children?.length) {
    for (const child of node.children) {
      renderNode(ctx, child, offsets, x, y)
    }
  }

  ctx.restore()
}

// ─── Shape primitives ─────────────────────────────────────────────────────────

function renderRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  node: RectNode,
  springDy: number,
): void {
  const { width, height, radius = 0, fill, stroke } = node

  // Shadow: as the element rises (springDy < 0), the shadow deepens and
  // shifts downward — matching the physics of a surface lifting away from a light.
  if (node.shadows?.length) {
    const s    = node.shadows[0]
    const rise = Math.max(0, -springDy)
    ctx.shadowColor     = s.color
    ctx.shadowBlur      = s.blur + rise * 2.5
    ctx.shadowOffsetX   = s.x
    ctx.shadowOffsetY   = s.y + rise * 0.5
  }

  buildRoundedRect(ctx, x, y, width, height, radius)

  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }

  clearShadow(ctx)

  if (stroke) {
    ctx.strokeStyle = stroke.color
    ctx.lineWidth   = stroke.width
    if (stroke.dash) ctx.setLineDash(stroke.dash)
    ctx.stroke()
    if (stroke.dash) ctx.setLineDash([])
  }
}

function renderText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  node: TextNode,
): void {
  ctx.font         = node.font
  ctx.fillStyle    = node.fill
  ctx.textAlign    = node.align    ?? 'left'
  ctx.textBaseline = node.baseline ?? 'alphabetic'

  if (node.maxWidth !== undefined && node.lineHeight !== undefined) {
    // Word-wrap: split into lines that fit within maxWidth
    const words = node.content.split(' ')
    const lines: string[] = []
    let line = ''

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width > node.maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * node.lineHeight)
    }
  } else {
    ctx.fillText(node.content, x, y, node.maxWidth)
  }
}

function renderCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  node: CircleNode,
): void {
  applyShadows(ctx, node.shadows)

  ctx.beginPath()
  ctx.arc(x, y, node.radius, 0, Math.PI * 2)

  if (node.fill) { ctx.fillStyle = node.fill; ctx.fill() }
  clearShadow(ctx)
  if (node.stroke) {
    ctx.strokeStyle = node.stroke.color
    ctx.lineWidth   = node.stroke.width
    ctx.stroke()
  }
}

function renderLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  node: LineNode,
): void {
  ctx.strokeStyle = node.stroke.color
  ctx.lineWidth   = node.stroke.width
  if (node.stroke.dash) ctx.setLineDash(node.stroke.dash)

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + node.dx, y + node.dy)
  ctx.stroke()

  if (node.stroke.dash) ctx.setLineDash([])
}

function renderGroup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  node: GroupNode,
  offsets: NodeOffsets,
): void {
  if (node.clipWidth !== undefined && node.clipHeight !== undefined) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, node.clipWidth, node.clipHeight)
    ctx.clip()
  }

  for (const child of node.children) {
    renderNode(ctx, child, offsets, x, y)
  }

  if (node.clipWidth !== undefined && node.clipHeight !== undefined) {
    ctx.restore()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y,     x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x,    y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x,    y,     x + radius, y)
  ctx.closePath()
}

function applyShadows(ctx: CanvasRenderingContext2D, shadows?: Shadow[]): void {
  if (!shadows?.length) return
  const s = shadows[0]
  ctx.shadowColor   = s.color
  ctx.shadowBlur    = s.blur
  ctx.shadowOffsetX = s.x
  ctx.shadowOffsetY = s.y
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor   = 'transparent'
  ctx.shadowBlur    = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}
