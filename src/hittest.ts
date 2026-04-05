/**
 * Axiom Hit Testing
 *
 * Determines which scene node is under a given (x, y) screen coordinate.
 * This replaces the browser's built-in event target resolution (which depends
 * on the DOM). Here, hit testing is explicit geometry — math, not black-box.
 *
 * Hit test order mirrors rendering order: nodes are checked last-to-first
 * (last node in the array = topmost visually = checked first).
 * Within a node, children are checked before the parent (children are on top).
 *
 * Only nodes with `interactive: true` can be returned.
 * Non-interactive nodes are transparent to hit testing.
 */

import type { SceneNode } from './types.js'
import type { NodeOffsets } from './renderer.js'

type Rect = { x: number; y: number; w: number; h: number }

function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

function pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}

/**
 * Returns the ID of the topmost interactive node at screen position (px, py).
 * Returns null if no interactive node is found.
 *
 * parentX, parentY: accumulated parent position (start at 0, 0 for root nodes)
 */
export function hitTest(
  nodes: SceneNode[],
  offsets: NodeOffsets,
  px: number,
  py: number,
  parentX = 0,
  parentY = 0,
): string | null {
  // Iterate in reverse: last node = topmost
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    const off = offsets.get(node.id)
    const nx = parentX + node.x + (off?.dx ?? 0)
    const ny = parentY + node.y + (off?.dy ?? 0)

    // Check children first — they sit on top of the parent visually
    if (node.children?.length) {
      const hit = hitTest(node.children, offsets, px, py, nx, ny)
      if (hit) return hit
    }

    if (!node.interactive) continue

    // Geometric test based on node type
    let hit = false

    switch (node.type) {
      case 'rect':
        hit = pointInRect(px, py, { x: nx, y: ny, w: node.width, h: node.height })
        break
      case 'circle':
        hit = pointInCircle(px, py, nx, ny, node.radius)
        break
      case 'group':
        // A group itself is not hittable unless it has explicit clip dimensions
        if (node.clipWidth !== undefined && node.clipHeight !== undefined) {
          hit = pointInRect(px, py, { x: nx, y: ny, w: node.clipWidth, h: node.clipHeight })
        }
        break
      case 'text':
        // Text nodes are generally not hit-testable; add bounding box if needed
        break
      case 'line':
        // Lines are rarely interactive; skip for now
        break
    }

    if (hit) return node.id
  }

  return null
}
