import type { SceneNode } from '../types.js'
import { kitTheme } from './theme.js'

export type ButtonParams = {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  /** When true, node receives pointer events and shows pointer cursor. */
  interactive?: boolean
  fill?: string
  labelFont?: string
}

/**
 * Simple pill-style button: one rect + centered label (single-line canvas text).
 */
export function button(p: ButtonParams): SceneNode[] {
  const fill = p.fill ?? kitTheme.accent
  const font = p.labelFont ?? kitTheme.fontButton
  const interactive = p.interactive ?? true

  return [
    {
      id: `${p.id}-bg`,
      type: 'rect',
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      fill,
      radius: kitTheme.radiusButton,
      interactive,
      cursor: interactive ? 'pointer' : undefined,
    },
    {
      id: `${p.id}-label`,
      type: 'text',
      x: p.x + p.width / 2,
      y: p.y + p.height / 2,
      content: p.label,
      font,
      fill: '#0a0a10',
      align: 'center',
      baseline: 'middle',
    },
  ]
}
