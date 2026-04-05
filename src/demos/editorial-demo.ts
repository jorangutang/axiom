/**
 * Editorial reflow: Pretext body text re-wraps every frame as card width oscillates.
 * Springs on hover for the card surface.
 */

import type { Scene } from '../types.js'
import { Runtime } from '../runtime.js'
import { card } from '../kit/card.js'
import { kitTheme } from '../kit/theme.js'

function headline(): SceneNodeText {
  return {
    id: 'ed-head',
    type: 'text',
    x: 0,
    y: 48,
    content: 'Pretext + canvas — layout at animation speed',
    font: '600 22px ui-sans-serif, system-ui, sans-serif',
    fill: kitTheme.textPrimary,
    align: 'center',
    baseline: 'top',
  }
}

// Avoid importing SceneNode union in type name — inline for headline helper
type SceneNodeText = Extract<import('../types.js').SceneNode, { type: 'text' }>

export class EditorialDemo {
  private runtime: Runtime
  private time = 0

  constructor(canvas: HTMLCanvasElement) {
    const vw = canvas.width / (window.devicePixelRatio ?? 1)
    const vh = canvas.height / (window.devicePixelRatio ?? 1)
    const scene = this.buildScene(vw, vh, 0)
    this.runtime = new Runtime(canvas, scene)
    this.wireSprings()
    this.runtime.setFrameCallback((dt) => {
      this.time += dt
      const w = vw
      const h = vh
      this.applyScene(this.time, w, h)
    })
  }

  private buildScene(vw: number, vh: number, _t: number): Scene {
    const cardW = 300
    const cardH = 260
    const x = (vw - cardW) / 2
    const y = (vh - cardH) / 2 + 10

    const head = headline()
    this.positionHeadline(head, vw)

    const nodes = [
      ...card({
        id: 'ed0',
        x,
        y,
        width: cardW,
        height: cardH,
        title: 'Living column',
        body:
          'This block uses @chenglou/pretext for line breaking. The card width oscillates; ' +
          'wrapping updates every frame with no DOM layout and no CSS. Pair with Axiom springs ' +
          'for editorial tools, dashboards, and data-dense surfaces where typography must track geometry.',
        interactive: true,
      }),
      head,
    ]

    return {
      formatVersion: 1,
      background: '#08080c',
      backgroundGradient: {
        cx: 0.5,
        cy: 0.35,
        r: 0.85,
        from: '#12121c',
        to: '#060608',
      },
      nodes,
    }
  }

  private positionHeadline(head: SceneNodeText, vw: number): void {
    head.x = vw / 2
  }

  private applyScene(t: number, vw: number, vh: number): void {
    const cardW = 260 + Math.sin(t * 1.15) * 55
    const cardH = 260
    const x = (vw - cardW) / 2
    const y = (vh - cardH) / 2 + 10

    const s = this.runtime.getScene()
    const bg = s.nodes.find((n) => n.id === 'ed0-bg')
    const body = s.nodes.find((n) => n.id === 'ed0-body')
    const title = s.nodes.find((n) => n.id === 'ed0-title')
    const head = s.nodes.find((n) => n.id === 'ed-head')

    if (bg?.type === 'rect') {
      bg.x = x
      bg.y = y
      bg.width = cardW
      bg.height = cardH
    }
    if (body?.type === 'text') {
      body.x = x + 18
      body.y = y + 18 + 28
      body.maxWidth = cardW - 36
    }
    if (title?.type === 'text') {
      title.x = x + 18
      title.y = y + 18
    }
    if (head?.type === 'text') {
      head.x = vw / 2
    }
  }

  private wireSprings(): void {
    const lift = ['ed0-bg', 'ed0-title', 'ed0-body'] as const
    this.runtime.on('mouseenter', (id) => {
      if (id === 'ed0-bg') {
        for (const nid of lift) {
          this.runtime.spring(nid, { dy: -10 }, { stiffness: 380, damping: 28 })
        }
      }
    })
    this.runtime.on('mouseleave', (id) => {
      if (id === 'ed0-bg') {
        for (const nid of lift) {
          this.runtime.spring(nid, { dy: 0 }, { stiffness: 200, damping: 22 })
        }
      }
    })
  }

  start(): void {}

  destroy(): void {
    this.runtime.setFrameCallback(null)
    this.runtime.destroy()
  }
}
