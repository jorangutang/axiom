/**
 * Pretext integration for Axiom text nodes.
 *
 * Caches `prepareWithSegments` handles per (id, content, font). Call
 * `clearPretextLayoutCache()` when the scene is replaced wholesale (see Runtime).
 */

import {
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

export function pretextBlockHeight(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
  lineHeight: number,
): number {
  return layoutWithLines(prepared, maxWidth, lineHeight).height
}

const preparedCache = new Map<string, PreparedTextWithSegments>()

function cacheKey(id: string, content: string, font: string): string {
  return `${id}\0${content}\0${font}`
}

export function getPreparedText(
  id: string,
  content: string,
  font: string,
): PreparedTextWithSegments {
  const key = cacheKey(id, content, font)
  let p = preparedCache.get(key)
  if (!p) {
    p = prepareWithSegments(content, font)
    preparedCache.set(key, p)
  }
  return p
}

export function clearPretextLayoutCache(): void {
  preparedCache.clear()
}

export type PretextLineDraw = { text: string; x: number; y: number }

/**
 * Lay out a text block with Pretext and return draw calls for each line.
 * Uses top-of-line vertical placement: pair with `textBaseline: 'top'`.
 */
export function layoutLinesForCanvas(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
  lineHeight: number,
  originX: number,
  originY: number,
  align: 'left' | 'center' | 'right',
): { lines: PretextLineDraw[]; totalHeight: number; blockWidth: number } {
  const { lines, height } = layoutWithLines(prepared, maxWidth, lineHeight)
  let blockWidth = 0
  for (const line of lines) {
    if (line.width > blockWidth) blockWidth = line.width
  }

  const out: PretextLineDraw[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    let x = originX
    if (align === 'center') {
      x = originX + (maxWidth - line.width) / 2
    } else if (align === 'right') {
      x = originX + maxWidth - line.width
    }
    out.push({ text: line.text, x, y: originY + i * lineHeight })
  }

  return { lines: out, totalHeight: height, blockWidth }
}
