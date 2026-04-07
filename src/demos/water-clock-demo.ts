/**
 * Water clock — Tier B reference: CPU ripple heightfield under UI; springs only on HUD.
 *
 * Run: `npm run dev` → `?demo=water`
 *
 * Ripples use `RippleSurface2D` + `Runtime.setRenderHooks({ afterBackground })`.
 * Timer logic is real-time `remainingMs`; `DropMetronome` adds a visual drop + impulse on an interval.
 */

import type { Scene, SceneNode, TextNode } from '../types.js'
import { Runtime } from '../runtime.js'
import type { RenderHooks } from '../renderer.js'
import { RippleSurface2D } from '../fx/ripple-surface.js'
import { DropMetronome } from '../fx/scheduled-drop.js'

type Phase = 'idle' | 'running' | 'paused' | 'done'

function findNode(nodes: SceneNode[], id: string): SceneNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '00:00'
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

const DEFAULT_DURATION_MS = 5 * 60 * 1000
const DROP_INTERVAL_SEC = 2.5

export class WaterClockDemo {
  private runtime: Runtime
  private canvas: HTMLCanvasElement
  private vw = 800
  private vh = 600

  private phase: Phase = 'idle'
  private durationMs = DEFAULT_DURATION_MS
  private remainingMs = DEFAULT_DURATION_MS
  private ripple: RippleSurface2D
  private metronome: DropMetronome

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const dpr = window.devicePixelRatio ?? 1
    this.vw = canvas.width / dpr
    this.vh = canvas.height / dpr

    this.ripple = new RippleSurface2D(72, 52, { damping: 0.987 })
    this.metronome = new DropMetronome({
      intervalSec: DROP_INTERVAL_SEC,
      onDrop: () => {
        if (this.phase !== 'running') return
        this.ripple.impulse(0.25 + Math.random() * 0.5, 0.25 + Math.random() * 0.45, 220)
      },
    })

    const scene = this.buildScene(this.vw, this.vh)
    this.runtime = new Runtime(canvas, scene)

    const hooks: RenderHooks = {
      afterBackground: (ctx, vp) => {
        const poolTop = vp.height * 0.5
        const poolH = vp.height * 0.5
        this.ripple.drawInto(ctx, 0, poolTop, vp.width, poolH)
      },
    }
    this.runtime.setRenderHooks(hooks)

    this.runtime.setFrameCallback((dt) => {
      this.ripple.step()
      if (this.phase === 'running') {
        this.remainingMs = Math.max(0, this.remainingMs - dt * 1000)
        this.metronome.tick(dt)
        if (this.remainingMs <= 0) {
          this.phase = 'done'
          this.runtime.spring('hud-card', { dy: -6 }, { stiffness: 200, damping: 18 })
        }
      }
      this.syncLabels()
    })

    this.wireSprings()
    this.wireClicks()
  }

  private buildScene(vw: number, vh: number): Scene {
    const cardW = Math.min(380, vw - 48)
    const cardX = (vw - cardW) / 2
    const cardY = vh * 0.12
    const cardH = 220
    const pad = 22

    const nodes: SceneNode[] = [
      {
        id: 'hud-card',
        type: 'group',
        x: cardX,
        y: cardY,
        children: [
          {
            id: 'hud-bg',
            type: 'rect',
            x: 0,
            y: 0,
            width: cardW,
            height: cardH,
            fill: 'rgba(12,16,28,0.88)',
            radius: 18,
            stroke: { color: 'rgba(255,255,255,0.1)', width: 1 },
            shadows: [{ x: 0, y: 14, blur: 36, color: 'rgba(0,0,0,0.45)' }],
          },
          {
            id: 'hud-title',
            type: 'text',
            x: cardW / 2,
            y: 28,
            content: 'Water clock',
            font: '600 18px ui-sans-serif, system-ui, sans-serif',
            fill: '#e8ecff',
            align: 'center',
            baseline: 'middle',
          },
          {
            id: 'timer-countdown-text',
            type: 'text',
            x: cardW / 2,
            y: 88,
            content: fmtMs(this.remainingMs),
            font: '800 44px ui-sans-serif, system-ui, sans-serif',
            fill: '#f2f6ff',
            align: 'center',
            baseline: 'middle',
          },
          {
            id: 'timer-sub',
            type: 'text',
            x: cardW / 2,
            y: 132,
            content:
              'Ripple field = wave grid (Tier B). Springs = this panel only. Tier C = WebGL water.',
            font: '400 12px ui-sans-serif, system-ui, sans-serif',
            fill: '#8a90b0',
            align: 'center',
            baseline: 'middle',
            maxWidth: cardW - pad * 2,
            lineHeight: 18,
            textLayout: 'pretext',
          },
          {
            id: 'drop-label',
            type: 'text',
            x: cardW / 2,
            y: 168,
            content: 'Drops: 0 · pool uses CPU ripple, not springs',
            font: '500 11px ui-monospace, monospace',
            fill: '#6ae0c8',
            align: 'center',
            baseline: 'middle',
          },
          {
            id: 'btn-start-bg',
            type: 'rect',
            x: pad,
            y: cardH - 48,
            width: 100,
            height: 36,
            fill: '#3d7eef',
            radius: 10,
            interactive: true,
            cursor: 'pointer',
            children: [
              {
                id: 'btn-start-txt',
                type: 'text',
                x: 50,
                y: 18,
                content: 'Start',
                font: '600 13px ui-sans-serif, system-ui, sans-serif',
                fill: '#081018',
                align: 'center',
                baseline: 'middle',
              },
            ],
          },
          {
            id: 'btn-pause-bg',
            type: 'rect',
            x: pad + 108,
            y: cardH - 48,
            width: 100,
            height: 36,
            fill: 'rgba(70,90,140,0.9)',
            radius: 10,
            interactive: true,
            cursor: 'pointer',
            children: [
              {
                id: 'btn-pause-txt',
                type: 'text',
                x: 50,
                y: 18,
                content: 'Pause',
                font: '600 13px ui-sans-serif, system-ui, sans-serif',
                fill: '#e8ecff',
                align: 'center',
                baseline: 'middle',
              },
            ],
          },
          {
            id: 'btn-reset-bg',
            type: 'rect',
            x: pad + 216,
            y: cardH - 48,
            width: 100,
            height: 36,
            fill: 'rgba(60,70,95,0.92)',
            radius: 10,
            interactive: true,
            cursor: 'pointer',
            children: [
              {
                id: 'btn-reset-txt',
                type: 'text',
                x: 50,
                y: 18,
                content: 'Reset',
                font: '600 13px ui-sans-serif, system-ui, sans-serif',
                fill: '#e0e4f0',
                align: 'center',
                baseline: 'middle',
              },
            ],
          },
        ],
      },
    ]

    return {
      formatVersion: 1,
      background: '#04060e',
      backgroundGradient: {
        cx: 0.5,
        cy: 0.55,
        r: 0.9,
        from: '#0a1022',
        to: '#020308',
      },
      nodes,
    }
  }

  private syncLabels(): void {
    const scene = this.runtime.getScene()
    const t = findNode(scene.nodes, 'timer-countdown-text')
    if (t?.type === 'text') (t as TextNode).content = fmtMs(this.remainingMs)
    const d = findNode(scene.nodes, 'drop-label')
    if (d?.type === 'text') {
      const status =
        this.phase === 'idle'
          ? 'Idle'
          : this.phase === 'running'
            ? 'Running'
            : this.phase === 'paused'
              ? 'Paused'
              : 'Done'
      ;(d as TextNode).content = `Drops: ${this.metronome.dropCount} · ${status}`
    }
  }

  private wireSprings(): void {
    const lift = { stiffness: 340, damping: 26 } as const
    for (const id of ['btn-start-bg', 'btn-pause-bg', 'btn-reset-bg'] as const) {
      this.runtime.on('mouseenter', (hid) => {
        if (hid === id) this.runtime.spring(id, { dy: -3 }, lift)
      })
      this.runtime.on('mouseleave', (hid) => {
        if (hid === id) this.runtime.spring(id, { dy: 0 }, lift)
      })
    }
  }

  private wireClicks(): void {
    this.runtime.on('click', (id) => {
      if (id === 'btn-start-bg') {
        if (this.phase === 'idle' || this.phase === 'done') {
          this.remainingMs = this.durationMs
          this.phase = 'running'
          this.metronome.reset()
        } else if (this.phase === 'paused') {
          this.phase = 'running'
        }
        return
      }
      if (id === 'btn-pause-bg') {
        if (this.phase === 'running') this.phase = 'paused'
        return
      }
      if (id === 'btn-reset-bg') {
        this.phase = 'idle'
        this.remainingMs = this.durationMs
        this.metronome.reset()
        this.ripple.clear()
      }
    })
  }

  start(): void {}

  destroy(): void {
    this.runtime.setFrameCallback(null)
    this.runtime.setRenderHooks(null)
    this.runtime.destroy()
  }
}
