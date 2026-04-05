import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import {
  clearPretextLayoutCache,
  getPreparedText,
  pretextBlockHeight,
  layoutLinesForCanvas,
} from './pretext-layout.js'

beforeAll(() => {
  const fakeCtx = {
    _font: '16px sans-serif',
    set font(f: string) {
      this._font = f
    },
    get font() {
      return this._font
    },
    measureText(s: string) {
      return { width: Math.max(0, [...s].length * 5.5) }
    },
  }
  globalThis.OffscreenCanvas = class {
    width = 1
    height = 1
    getContext(type: string) {
      if (type === '2d') return fakeCtx as unknown as CanvasRenderingContext2D
      return null
    }
  } as unknown as typeof OffscreenCanvas
})

describe('pretext-layout', () => {
  beforeEach(() => {
    clearPretextLayoutCache()
  })

  it('pretextBlockHeight matches layoutWithLines height', () => {
    const p = prepareWithSegments('Hello world. '.repeat(12), '16px sans-serif')
    const w = 140
    const lh = 22
    expect(pretextBlockHeight(p, w, lh)).toBe(layoutWithLines(p, w, lh).height)
  })

  it('layoutLinesForCanvas returns lines with text', () => {
    const p = prepareWithSegments('Short text', '14px sans-serif')
    const { lines, totalHeight } = layoutLinesForCanvas(p, 200, 18, 10, 20, 'left')
    expect(lines.length).toBeGreaterThan(0)
    expect(totalHeight).toBe(lines.length * 18)
    expect(lines[0]?.text.length).toBeGreaterThan(0)
  })

  it('getPreparedText caches by id+content+font', () => {
    const a = getPreparedText('n1', 'same', '14px serif')
    const b = getPreparedText('n1', 'same', '14px serif')
    const c = getPreparedText('n2', 'same', '14px serif')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
