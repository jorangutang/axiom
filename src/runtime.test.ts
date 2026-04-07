import { describe, it, expect } from 'vitest'
import { validateScene } from './runtime.js'
import type { Scene, SceneNode } from './types.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rect(id: string, overrides: Partial<SceneNode> = {}): SceneNode {
  return { type: 'rect', id, x: 0, y: 0, width: 100, height: 50, ...overrides } as SceneNode
}

function circle(id: string, overrides: Partial<SceneNode> = {}): SceneNode {
  return { type: 'circle', id, x: 0, y: 0, radius: 20, ...overrides } as SceneNode
}

function textNode(id: string, overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    type: 'text',
    id,
    x: 0,
    y: 0,
    content: 'hello',
    font: '16px sans-serif',
    fill: '#000',
    ...overrides,
  } as SceneNode
}

function lineNode(id: string, overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    type: 'line',
    id,
    x: 0,
    y: 0,
    dx: 100,
    dy: 0,
    stroke: { color: '#fff', width: 1 },
    ...overrides,
  } as SceneNode
}

function groupNode(
  id: string,
  children: SceneNode[] = [],
  overrides: Partial<SceneNode> = {},
): SceneNode {
  return { type: 'group', id, x: 0, y: 0, children, ...overrides } as SceneNode
}

function scene(nodes: SceneNode[]): Scene {
  return { nodes }
}

// ─── validateScene ────────────────────────────────────────────────────────────

describe('validateScene — valid scenes', () => {
  it('returns no errors for a valid minimal scene', () => {
    expect(validateScene(scene([rect('a')]))).toHaveLength(0)
  })

  it('returns no errors for a scene with all node types', () => {
    const errors = validateScene(
      scene([
        rect('r'),
        circle('c'),
        textNode('t'),
        lineNode('l'),
        groupNode('g', [rect('g-child')]),
      ]),
    )
    expect(errors).toHaveLength(0)
  })

  it('returns no errors for an empty nodes array', () => {
    expect(validateScene(scene([]))).toHaveLength(0)
  })

  it('accepts opacity exactly at bounds', () => {
    expect(validateScene(scene([rect('a', { opacity: 0 })]))).toHaveLength(0)
    expect(validateScene(scene([rect('b', { opacity: 1 })]))).toHaveLength(0)
  })

  it('accepts text with maxWidth and lineHeight both set', () => {
    const errors = validateScene(scene([textNode('t', { maxWidth: 200, lineHeight: 24 })]))
    expect(errors).toHaveLength(0)
  })

  it('accepts group with clip dimensions both set', () => {
    const errors = validateScene(
      scene([groupNode('g', [], { clipWidth: 100, clipHeight: 80 } as Partial<SceneNode>)]),
    )
    expect(errors).toHaveLength(0)
  })
})

describe('validateScene — ID errors', () => {
  it('reports missing id', () => {
    const node = { type: 'rect', x: 0, y: 0, width: 10, height: 10 } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('missing or empty "id"'))).toBe(true)
  })

  it('reports duplicate ids', () => {
    const errors = validateScene(scene([rect('a'), rect('a')]))
    expect(errors.some((e) => e.includes('duplicate id'))).toBe(true)
  })

  it('reports duplicate ids across nested children', () => {
    const errors = validateScene(scene([rect('a', { children: [rect('a')] })]))
    expect(errors.some((e) => e.includes('duplicate id'))).toBe(true)
  })
})

describe('validateScene — opacity errors', () => {
  it('reports opacity below 0', () => {
    const errors = validateScene(scene([rect('a', { opacity: -0.1 })]))
    expect(errors.some((e) => e.includes('opacity') && e.includes('out of range'))).toBe(true)
  })

  it('reports opacity above 1', () => {
    const errors = validateScene(scene([rect('a', { opacity: 1.1 })]))
    expect(errors.some((e) => e.includes('opacity') && e.includes('out of range'))).toBe(true)
  })
})

describe('validateScene — rect errors', () => {
  it('reports negative width', () => {
    const errors = validateScene(scene([rect('a', { width: -10 } as Partial<SceneNode>)]))
    expect(errors.some((e) => e.includes('width'))).toBe(true)
  })

  it('reports missing height', () => {
    const node = { type: 'rect', id: 'a', x: 0, y: 0, width: 10 } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('height'))).toBe(true)
  })
})

describe('validateScene — circle errors', () => {
  it('reports negative radius', () => {
    const errors = validateScene(scene([circle('c', { radius: -5 } as Partial<SceneNode>)]))
    expect(errors.some((e) => e.includes('radius'))).toBe(true)
  })
})

describe('validateScene — text errors', () => {
  it('reports missing font', () => {
    const node = {
      type: 'text',
      id: 't',
      x: 0,
      y: 0,
      content: 'hi',
      fill: '#000',
    } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('font'))).toBe(true)
  })

  it('reports missing fill', () => {
    const node = {
      type: 'text',
      id: 't',
      x: 0,
      y: 0,
      content: 'hi',
      font: '16px sans-serif',
    } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('fill'))).toBe(true)
  })

  it('warns when maxWidth is set without lineHeight', () => {
    const errors = validateScene(scene([textNode('t', { maxWidth: 200 } as Partial<SceneNode>)]))
    expect(errors.some((e) => e.includes('lineHeight'))).toBe(true)
  })

  it('warns when pretext layout is used without maxWidth', () => {
    const errors = validateScene(
      scene([textNode('t', { textLayout: 'pretext' } as Partial<SceneNode>)]),
    )
    expect(errors.some((e) => e.includes('pretext') && e.includes('maxWidth'))).toBe(true)
  })
})

describe('validateScene — line errors', () => {
  it('reports missing stroke', () => {
    const node = {
      type: 'line',
      id: 'l',
      x: 0,
      y: 0,
      dx: 50,
      dy: 0,
    } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('stroke'))).toBe(true)
  })

  it('reports missing dx', () => {
    const node = {
      type: 'line',
      id: 'l',
      x: 0,
      y: 0,
      dy: 0,
      stroke: { color: '#fff', width: 1 },
    } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('dx'))).toBe(true)
  })
})

describe('validateScene — group errors', () => {
  it('reports when only clipWidth is set without clipHeight', () => {
    const node = {
      type: 'group',
      id: 'g',
      x: 0,
      y: 0,
      children: [],
      clipWidth: 100,
    } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('clipWidth') && e.includes('clipHeight'))).toBe(true)
  })

  it('reports when only clipHeight is set without clipWidth', () => {
    const node = {
      type: 'group',
      id: 'g',
      x: 0,
      y: 0,
      children: [],
      clipHeight: 80,
    } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('clipWidth') && e.includes('clipHeight'))).toBe(true)
  })
})

describe('validateScene — unknown node type', () => {
  it('reports unknown type from LLM-generated JSON', () => {
    const node = { type: 'polygon', id: 'p', x: 0, y: 0 } as unknown as SceneNode
    const errors = validateScene(scene([node]))
    expect(errors.some((e) => e.includes('unknown node type'))).toBe(true)
  })
})

describe('validateScene — nested children', () => {
  it('validates children recursively', () => {
    const badChild = {
      type: 'rect',
      id: '',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    } as unknown as SceneNode
    const parent = rect('parent', { children: [badChild] })
    const errors = validateScene(scene([parent]))
    expect(errors.some((e) => e.includes('missing or empty "id"'))).toBe(true)
  })

  it('accumulates multiple errors across the tree', () => {
    const nodes: SceneNode[] = [
      rect('dup'),
      rect('dup'), // duplicate
      circle('c', { radius: -1 } as Partial<SceneNode>), // negative radius
    ]
    const errors = validateScene(scene(nodes))
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})
