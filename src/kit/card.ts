import type { SceneNode } from '../types.js'
import { kitTheme } from './theme.js'

export type CardParams = {
  id: string
  x: number
  y: number
  width: number
  height: number
  title: string
  body: string
  titleFont?: string
  bodyFont?: string
  fill?: string
  interactive?: boolean
}

/**
 * Card chrome: background rect, title, body with Pretext wrapping.
 */
export function card(p: CardParams): SceneNode[] {
  const pad = 18
  const titleFont = p.titleFont ?? kitTheme.fontTitle
  const bodyFont = p.bodyFont ?? kitTheme.fontBody
  const fill = p.fill ?? kitTheme.bgCard

  return [
    {
      id: `${p.id}-bg`,
      type: 'rect',
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      fill,
      radius: kitTheme.radiusCard,
      stroke: { color: kitTheme.border, width: 1 },
      shadows: [{ ...kitTheme.shadowCard }],
      interactive: p.interactive ?? false,
      cursor: p.interactive ? 'pointer' : undefined,
    },
    {
      id: `${p.id}-title`,
      type: 'text',
      x: p.x + pad,
      y: p.y + pad,
      content: p.title,
      font: titleFont,
      fill: kitTheme.textPrimary,
      baseline: 'top',
    },
    {
      id: `${p.id}-body`,
      type: 'text',
      x: p.x + pad,
      y: p.y + pad + 28,
      content: p.body,
      font: bodyFont,
      fill: kitTheme.textMuted,
      baseline: 'top',
      maxWidth: p.width - pad * 2,
      lineHeight: 21,
      textLayout: 'pretext',
    },
  ]
}
