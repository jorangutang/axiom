/**
 * Axiom Demo
 *
 * This is the scene a human would describe as:
 *   "Three feature cards with a title and tagline above them.
 *    Cards should spring upward when hovered and depress slightly when clicked.
 *    Dark background with a subtle radial glow from the center."
 *
 * That description becomes the scene definition below — explicit coordinates,
 * spring configs, and interaction handlers. No CSS. No components. No DOM layout.
 * A language model generates this. A human reads it and immediately understands
 * exactly where everything is and what it does.
 */

import { Runtime } from './runtime.js'
import type { Scene, SceneNode } from './types.js'

// ─── Canvas / DPR setup ───────────────────────────────────────────────────────

const canvas = document.getElementById('c') as HTMLCanvasElement

function setupCanvas(): { vw: number; vh: number } {
  const dpr = window.devicePixelRatio ?? 1
  const vw  = window.innerWidth
  const vh  = window.innerHeight

  canvas.width        = vw * dpr
  canvas.height       = vh * dpr
  canvas.style.width  = `${vw}px`
  canvas.style.height = `${vh}px`

  // Apply DPR scale once. Setting canvas.width above resets the transform,
  // so this call correctly establishes CSS-pixel coordinate space.
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  return { vw, vh }
}

// ─── Scene definition ─────────────────────────────────────────────────────────
//
// This function takes the current viewport size and returns a complete Scene.
// In production, this JSON would come from a language model.
// Here, we author it in TypeScript to demonstrate the format.

function buildScene(vw: number, vh: number): Scene {
  // Layout constants — the math an LLM would compute
  const CARD_W   = 300
  const CARD_H   = 210
  const CARD_GAP = 28
  const ROW_W    = CARD_W * 3 + CARD_GAP * 2
  const ROW_X    = (vw - ROW_W) / 2
  const ROW_Y    = vh / 2 - 40

  const cardDefs = [
    {
      id:     'card-0',
      title:  'Coordinate Native',
      desc:   'Every element has an exact position in 2D space. No layout engine. No cascade. Math all the way down.',
      accent: '#4F8EF7',
    },
    {
      id:     'card-1',
      title:  'Physics First',
      desc:   'Spring dynamics, momentum, drag resistance. Not CSS easing — real force equations that create tactile depth.',
      accent: '#9B72F8',
    },
    {
      id:     'card-2',
      title:  'LLM Authored',
      desc:   'Describe your intent in plain language. Receive coordinates. The gap between thought and pixels is bridged.',
      accent: '#34D399',
    },
  ]

  const cardNodes: SceneNode[] = cardDefs.map((card, i) => ({
    id:          card.id,
    type:        'rect',
    x:           ROW_X + i * (CARD_W + CARD_GAP),
    y:           ROW_Y,
    width:       CARD_W,
    height:      CARD_H,
    fill:        '#0C0C1A',
    radius:      14,
    stroke:      { color: 'rgba(255,255,255,0.07)', width: 1 },
    shadows:     [{ x: 0, y: 10, blur: 44, color: 'rgba(0,0,0,0.7)' }],
    interactive: true,
    cursor:      'pointer',
    children: [
      // Accent bar — a colored strip that identifies the card's theme
      {
        id:     `${card.id}-accent`,
        type:   'rect',
        x:      20,
        y:      22,
        width:  28,
        height: 3,
        radius: 2,
        fill:   card.accent,
      } as SceneNode,

      // Card title
      {
        id:       `${card.id}-title`,
        type:     'text',
        x:        20,
        y:        44,
        content:  card.title,
        font:     '600 15px "SF Pro Display", Inter, system-ui, sans-serif',
        fill:     '#DCDCF0',
        baseline: 'top',
      } as SceneNode,

      // Card description — word-wrapped
      {
        id:         `${card.id}-desc`,
        type:       'text',
        x:          20,
        y:          74,
        content:    card.desc,
        font:       '400 13px "SF Pro Text", Inter, system-ui, sans-serif',
        fill:       '#3A3A56',
        baseline:   'top',
        maxWidth:   CARD_W - 40,
        lineHeight: 21,
      } as SceneNode,

      // Faint accent symbol in the bottom-right corner
      {
        id:       `${card.id}-glyph`,
        type:     'text',
        x:        CARD_W - 24,
        y:        CARD_H - 24,
        content:  ['⌖', '◈', '⬡'][i],
        font:     '400 18px system-ui',
        fill:     card.accent + '28',   // accent at ~16% opacity
        align:    'center',
        baseline: 'middle',
      } as SceneNode,
    ],
  }))

  return {
    background: '#060608',

    backgroundGradient: {
      cx:   0.5,
      cy:   0.48,
      r:    0.72,
      from: '#0D0D22',
      to:   '#060608',
    },

    nodes: [
      // ── Wordmark ────────────────────────────────────────────────────────────
      {
        id:       'wordmark',
        type:     'text',
        x:        vw / 2,
        y:        ROW_Y - 110,
        content:  'AXIOM',
        font:     '800 46px "SF Pro Display", Inter, system-ui, sans-serif',
        fill:     '#DCDCF0',
        align:    'center',
        baseline: 'middle',
      },

      // ── Tagline ─────────────────────────────────────────────────────────────
      {
        id:       'tagline',
        type:     'text',
        x:        vw / 2,
        y:        ROW_Y - 60,
        content:  'Mathematical UI  ·  Physics-First  ·  LLM-Authored',
        font:     '400 12px "SF Pro Text", Inter, system-ui, sans-serif',
        fill:     '#26263A',
        align:    'center',
        baseline: 'middle',
      },

      // ── Cards ────────────────────────────────────────────────────────────────
      ...cardNodes,

      // ── Footer note ──────────────────────────────────────────────────────────
      {
        id:       'footer',
        type:     'text',
        x:        vw / 2,
        y:        ROW_Y + CARD_H + 52,
        content:  'No CSS layout  ·  No DOM  ·  Pure coordinates  ·  Canvas rendered',
        font:     '400 11px "SF Pro Text", Inter, system-ui, sans-serif',
        fill:     '#141420',
        align:    'center',
        baseline: 'top',
      },
    ],
  }
}

// ─── Runtime instantiation ────────────────────────────────────────────────────

let { vw, vh } = setupCanvas()
let runtime     = new Runtime(canvas, buildScene(vw, vh))

wireInteractions()

// Rebuild scene on resize (scene coordinates are viewport-relative)
window.addEventListener('resize', () => {
  runtime.destroy()
  ;({ vw, vh } = setupCanvas())
  runtime = new Runtime(canvas, buildScene(vw, vh))
  wireInteractions()
})

// ─── Interaction handlers ─────────────────────────────────────────────────────
//
// These are the behavioral layer — separate from the scene definition.
// They translate input events into spring targets.
//
// In the full platform, these would be generated from a natural language
// description of desired behavior: "cards spring up on hover, depress on click."

function wireInteractions(): void {
  // Spring configs
  const HOVER  = { stiffness: 320, damping: 24 }
  const PRESS  = { stiffness: 460, damping: 30 }

  runtime.on('mouseenter', (id) => {
    if (id.startsWith('card-')) {
      // Card rises 10px upward. Shadow automatically deepens in the renderer
      // because renderRect receives the springDy value.
      runtime.spring(id, { dy: -10 }, HOVER)
    }
  })

  runtime.on('mouseleave', (id) => {
    if (id.startsWith('card-')) {
      runtime.spring(id, { dy: 0 }, HOVER)
    }
  })

  runtime.on('mousedown', (id) => {
    if (id.startsWith('card-')) {
      // Press: dip back down toward 0, as if the card is being pushed
      runtime.spring(id, { dy: -4 }, PRESS)
    }
  })

  runtime.on('mouseup', (id) => {
    if (id.startsWith('card-')) {
      // Release: spring back to full hover height
      runtime.spring(id, { dy: -10 }, HOVER)
    }
  })
}
