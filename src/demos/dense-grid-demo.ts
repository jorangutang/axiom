/**
 * Dense grid: many Pretext-labeled cells with hover lift springs.
 */

import type { Scene, SceneNode } from '../types.js'
import { Runtime } from '../runtime.js'
import { kitTheme } from '../kit/theme.js'

const COLS = 10
const ROWS = 6
const GAP = 6
const PAD = 24

export class DenseGridDemo {
  private runtime: Runtime

  constructor(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio ?? 1
    const vw = canvas.width / dpr
    const vh = canvas.height / dpr
    const scene = this.buildScene(vw, vh)
    this.runtime = new Runtime(canvas, scene)

    this.runtime.on('mouseenter', (hitId) => {
      if (hitId.endsWith('-hit')) {
        const groupId = hitId.replace(/-hit$/, '-group')
        this.runtime.spring(groupId, { dy: -4 }, { stiffness: 420, damping: 26 })
      }
    })
    this.runtime.on('mouseleave', (hitId) => {
      if (hitId.endsWith('-hit')) {
        const groupId = hitId.replace(/-hit$/, '-group')
        this.runtime.spring(groupId, { dy: 0 }, { stiffness: 220, damping: 22 })
      }
    })
  }

  private buildScene(vw: number, vh: number): Scene {
    const innerW = vw - PAD * 2
    const innerH = vh - PAD * 2 - 40
    const cellW = (innerW - (COLS - 1) * GAP) / COLS
    const cellH = (innerH - (ROWS - 1) * GAP) / ROWS

    const nodes: SceneNode[] = [
      {
        id: 'dg-title',
        type: 'text',
        x: vw / 2,
        y: 20,
        content: 'Dense grid — per-cell Pretext labels',
        font: '600 18px ui-sans-serif, system-ui, sans-serif',
        fill: kitTheme.textPrimary,
        align: 'center',
        baseline: 'top',
      },
    ]

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const id = `c${row}-${col}`
        const x = PAD + col * (cellW + GAP)
        const y = PAD + 36 + row * (cellH + GAP)

        const label = `R${row}C${col}`
        const pad = 5
        nodes.push({
          id: `${id}-group`,
          type: 'group',
          x,
          y,
          children: [
            {
              id: `${id}-hit`,
              type: 'rect',
              x: 0,
              y: 0,
              width: cellW,
              height: cellH,
              fill: '#1a1a24',
              radius: 4,
              stroke: { color: '#2e2e3c', width: 1 },
              interactive: true,
              cursor: 'pointer',
            },
            {
              id: `${id}-txt`,
              type: 'text',
              x: pad,
              y: pad,
              content: label,
              font: '500 10px ui-monospace, monospace',
              fill: '#b0b0c0',
              baseline: 'top',
              maxWidth: cellW - pad * 2,
              lineHeight: 12,
              textLayout: 'pretext',
            },
          ],
        })
      }
    }

    return {
      formatVersion: 1,
      background: '#07070a',
      nodes,
    }
  }

  start(): void {}

  destroy(): void {
    this.runtime.destroy()
  }
}
