import { describe, it, expect } from 'vitest'
import { hitTest } from './hittest.js'
import type { SceneNode } from './types.js'
import type { NodeOffsets } from './renderer.js'

// Convenience: empty offsets map
const noOffsets: NodeOffsets = new Map()

// Helpers to build nodes concisely
function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  interactive = true,
  children?: SceneNode[],
): SceneNode {
  return { type: 'rect', id, x, y, width: w, height: h, interactive, children }
}

function circle(id: string, x: number, y: number, radius: number, interactive = true): SceneNode {
  return { type: 'circle', id, x, y, radius, interactive }
}

function group(
  id: string,
  x: number,
  y: number,
  children: SceneNode[],
  clip?: { w: number; h: number },
  interactive = true,
): SceneNode {
  return {
    type: 'group',
    id,
    x,
    y,
    children,
    clipWidth: clip?.w,
    clipHeight: clip?.h,
    interactive,
  }
}

function text(id: string, x: number, y: number, interactive = true): SceneNode {
  return {
    type: 'text',
    id,
    x,
    y,
    content: 'hello',
    font: '16px sans-serif',
    fill: '#000',
    interactive,
  }
}

describe('hitTest — basic geometry', () => {
  it('returns null for an empty scene', () => {
    expect(hitTest([], noOffsets, 50, 50)).toBeNull()
  })

  it('returns null when no nodes are interactive', () => {
    const nodes = [rect('a', 0, 0, 100, 100, false)]
    expect(hitTest(nodes, noOffsets, 50, 50)).toBeNull()
  })

  it('hits a rect that contains the point', () => {
    const nodes = [rect('a', 10, 10, 80, 80)]
    expect(hitTest(nodes, noOffsets, 50, 50)).toBe('a')
  })

  it('misses a rect when the point is outside', () => {
    const nodes = [rect('a', 10, 10, 80, 80)]
    expect(hitTest(nodes, noOffsets, 5, 5)).toBeNull()
    expect(hitTest(nodes, noOffsets, 100, 100)).toBeNull()
  })

  it('hits rect boundary (inclusive edges)', () => {
    const nodes = [rect('a', 10, 10, 80, 80)]
    expect(hitTest(nodes, noOffsets, 10, 10)).toBe('a') // top-left corner
    expect(hitTest(nodes, noOffsets, 90, 90)).toBe('a') // bottom-right corner (10+80=90)
  })

  it('hits a circle that contains the point', () => {
    const nodes = [circle('c', 50, 50, 30)]
    expect(hitTest(nodes, noOffsets, 50, 50)).toBe('c') // center
    expect(hitTest(nodes, noOffsets, 50, 79)).toBe('c') // just inside edge
  })

  it('misses a circle when the point is outside', () => {
    const nodes = [circle('c', 50, 50, 30)]
    expect(hitTest(nodes, noOffsets, 50, 81)).toBeNull() // just outside
    expect(hitTest(nodes, noOffsets, 0, 0)).toBeNull()
  })
})

describe('hitTest — z-ordering', () => {
  it('returns last node in array (topmost) when two rects overlap', () => {
    const nodes = [rect('bottom', 0, 0, 100, 100), rect('top', 0, 0, 100, 100)]
    expect(hitTest(nodes, noOffsets, 50, 50)).toBe('top')
  })

  it('falls through to lower node when topmost is non-interactive', () => {
    const nodes = [
      rect('bottom', 0, 0, 100, 100),
      rect('top', 0, 0, 100, 100, false), // non-interactive
    ]
    expect(hitTest(nodes, noOffsets, 50, 50)).toBe('bottom')
  })
})

describe('hitTest — parent/child priority', () => {
  it('returns child ID when child covers the hit point', () => {
    const child = rect('child', 20, 20, 40, 40)
    const parent = rect('parent', 0, 0, 100, 100, true, [child])
    expect(hitTest([parent], noOffsets, 40, 40)).toBe('child')
  })

  it('returns parent ID when point is in parent but outside child', () => {
    const child = rect('child', 50, 50, 40, 40)
    const parent = rect('parent', 0, 0, 100, 100, true, [child])
    expect(hitTest([parent], noOffsets, 10, 10)).toBe('parent')
  })

  it('child position is relative to parent', () => {
    // parent at (100, 100), child at (20, 20) relative → absolute (120, 120)
    const child = rect('child', 20, 20, 30, 30)
    const parent = rect('parent', 100, 100, 80, 80, true, [child])
    expect(hitTest([parent], noOffsets, 130, 130)).toBe('child')
    expect(hitTest([parent], noOffsets, 110, 110)).toBe('parent') // inside parent, outside child
  })
})

describe('hitTest — groups', () => {
  it('group without clip bounds is never itself hittable', () => {
    const g = group('g', 0, 0, [], undefined, true)
    expect(hitTest([g], noOffsets, 50, 50)).toBeNull()
  })

  it('group with clip bounds is hittable within those bounds', () => {
    const g = group('g', 10, 10, [], { w: 80, h: 80 })
    expect(hitTest([g], noOffsets, 50, 50)).toBe('g')
    expect(hitTest([g], noOffsets, 5, 5)).toBeNull()
  })

  it('children inside a group are hittable regardless of group clip', () => {
    const child = rect('child', 10, 10, 30, 30)
    const g = group('g', 20, 20, [child], undefined) // no clip
    expect(hitTest([g], noOffsets, 40, 40)).toBe('child') // 20+10=30, 30+30=60
  })
})

describe('hitTest — text nodes', () => {
  it('text node without maxWidth/lineHeight is not hittable', () => {
    const nodes = [text('t', 10, 10)] // no maxWidth/lineHeight
    expect(hitTest(nodes, noOffsets, 10, 10)).toBeNull()
  })

  it('text node with maxWidth and lineHeight is hittable within that box', () => {
    const node: SceneNode = {
      type: 'text',
      id: 't',
      x: 20,
      y: 30,
      content: 'Hello',
      font: '16px sans-serif',
      fill: '#000',
      interactive: true,
      maxWidth: 100,
      lineHeight: 24,
    }
    expect(hitTest([node], noOffsets, 60, 42)).toBe('t') // inside box
    expect(hitTest([node], noOffsets, 19, 30)).toBeNull() // left of x
    expect(hitTest([node], noOffsets, 20, 55)).toBeNull() // below y + lineHeight
  })

  it('non-interactive text node is never hittable even with maxWidth/lineHeight', () => {
    const node: SceneNode = {
      type: 'text',
      id: 't',
      x: 0,
      y: 0,
      content: 'Hello',
      font: '16px sans-serif',
      fill: '#000',
      interactive: false,
      maxWidth: 200,
      lineHeight: 20,
    }
    expect(hitTest([node], noOffsets, 50, 10)).toBeNull()
  })
})

describe('hitTest — spring offsets', () => {
  it('applies dx/dy offsets from the offsets map', () => {
    const nodes = [rect('a', 0, 0, 50, 50)]
    // Spring has displaced node by (30, 30)
    const offsets: NodeOffsets = new Map([['a', { dx: 30, dy: 30 }]])
    // Node now occupies (30,30)→(80,80)
    expect(hitTest(nodes, offsets, 55, 55)).toBe('a')
    // Original position (0,0)→(50,50) no longer hits because offset moved it
    expect(hitTest(nodes, offsets, 10, 10)).toBeNull()
  })

  it('zero offset in map behaves the same as no offset entry', () => {
    const nodes = [rect('a', 10, 10, 80, 80)]
    const offsets: NodeOffsets = new Map([['a', { dx: 0, dy: 0 }]])
    expect(hitTest(nodes, offsets, 50, 50)).toBe('a')
    expect(hitTest(nodes, noOffsets, 50, 50)).toBe('a')
  })
})
