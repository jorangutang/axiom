import type { TextNode } from '../types.js'

export type TextBlockParams = {
  id: string
  x: number
  y: number
  content: string
  font: string
  fill: string
  maxWidth: number
  lineHeight: number
  /** Use Pretext for wrapping (recommended for i18n and quality). */
  usePretext?: boolean
  align?: TextNode['align']
  baseline?: TextNode['baseline']
}

/**
 * Single text node configured for block layout (wrapped paragraph).
 */
export function textBlock(p: TextBlockParams): TextNode {
  return {
    id: p.id,
    type: 'text',
    x: p.x,
    y: p.y,
    content: p.content,
    font: p.font,
    fill: p.fill,
    maxWidth: p.maxWidth,
    lineHeight: p.lineHeight,
    align: p.align ?? 'left',
    baseline: p.baseline ?? 'top',
    textLayout: p.usePretext === false ? undefined : 'pretext',
  }
}
