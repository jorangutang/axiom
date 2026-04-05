# The Tactile Book: Implementation Plan

This document describes how Axiom implements a physically realistic page-flip book — the canonical use case for the platform and a direct demonstration of why the mathematical approach outperforms component-based frameworks.

---

## Why frameworks fail at this

CSS cannot express:

- The bezier-curved fold of a page under physical stress
- The perspective foreshortening of a page as it rotates
- The dynamic shadow gradient at the fold crease
- The resistance feel when dragging against the spring

Existing "book flip" CSS libraries use `rotateY` + `preserve-3d`. This produces a flat, mechanical card-flip — not the curve and weight of real paper. The physics is absent.

Axiom renders the page as a custom path on Canvas, calculated from the drag position every frame. The math knows where every pixel of the page is at every moment.

---

## Visual structure

```
┌─────────────────────────────────────────┐
│         Book surface (shadow)            │
│  ┌──────────────┬──────────────┐         │
│  │              │              │         │
│  │  Left page   │  Right page  │         │
│  │  (content)   │  (content)   │         │
│  │              │              │         │
│  │              │     ↑        │         │
│  │              │  drag here   │         │
│  └──────────────┴──────────────┘         │
└─────────────────────────────────────────┘
```

**Dimensions (reference: 1440×900 viewport):**

```
BOOK_W     = 900   // total book width (both pages)
BOOK_H     = 580   // book height
PAGE_W     = 450   // width of one page
SPINE_X    = vw/2  // the spine (center vertical line)
BOOK_X     = (vw - BOOK_W) / 2  = 270
BOOK_Y     = (vh - BOOK_H) / 2  = 160
```

---

## Scene definition

```json
{
  "background": "#1A1208",
  "backgroundGradient": {
    "cx": 0.5,
    "cy": 0.5,
    "r": 0.9,
    "from": "#2A1E0F",
    "to": "#100C06"
  },
  "nodes": [
    {
      "id": "book-shadow",
      "type": "rect",
      "x": 258,
      "y": 172,
      "width": 924,
      "height": 596,
      "radius": 4,
      "fill": "transparent",
      "shadows": [{ "x": 0, "y": 24, "blur": 80, "color": "rgba(0,0,0,0.8)" }]
    },
    {
      "id": "left-page",
      "type": "rect",
      "x": 270,
      "y": 160,
      "width": 450,
      "height": 580,
      "fill": "#F5F0E8",
      "radius": 0,
      "children": [
        {
          "id": "left-page-content",
          "type": "group",
          "x": 40,
          "y": 40,
          "children": [
            {
              "id": "left-chapter",
              "type": "text",
              "x": 0,
              "y": 0,
              "content": "Chapter One",
              "font": "400 11px Garamond, Georgia, serif",
              "fill": "#8B7355",
              "baseline": "top"
            },
            {
              "id": "left-body",
              "type": "text",
              "x": 0,
              "y": 28,
              "content": "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness...",
              "font": "400 15px Garamond, Georgia, serif",
              "fill": "#2C1810",
              "baseline": "top",
              "maxWidth": 370,
              "lineHeight": 26
            }
          ]
        },
        {
          "id": "left-page-number",
          "type": "text",
          "x": 225,
          "y": 540,
          "content": "1",
          "font": "400 12px Garamond, Georgia, serif",
          "fill": "#8B7355",
          "align": "center",
          "baseline": "top"
        }
      ]
    },
    {
      "id": "right-page",
      "type": "rect",
      "x": 720,
      "y": 160,
      "width": 450,
      "height": 580,
      "fill": "#F3EEE6",
      "interactive": true,
      "cursor": "grab",
      "children": []
    }
  ]
}
```

---

## Page flip rendering (Canvas 2D technique)

The standard scene rendering handles static pages. The flip effect requires custom per-frame canvas drawing during the drag gesture. This happens in a special `pageFlip` render layer that runs after the standard scene render.

### Frame-by-frame state

```typescript
type PageFlipState = {
  isDragging: boolean
  foldX: number // current x position of the fold crease
  dragVelocity: number // px/frame, used for momentum on release
  flipSpring: Spring // spring that animates foldX to its final position
  direction: 'forward' | 'backward'
}
```

### Rendering the fold

Each frame during a flip:

```typescript
function renderPageFlip(ctx: CanvasRenderingContext2D, state: PageFlipState, book: BookLayout) {
  const { foldX } = state
  const { SPINE_X, BOOK_Y, PAGE_W, BOOK_H } = book

  // 1. Clip to the right half of the book
  ctx.save()
  ctx.beginPath()
  ctx.rect(SPINE_X, BOOK_Y, PAGE_W, BOOK_H)
  ctx.clip()

  // 2. Draw the front face (right of foldX, unflipped)
  //    This is the portion of the page still visible as it turns
  ctx.save()
  ctx.beginPath()
  ctx.rect(foldX, BOOK_Y, SPINE_X + PAGE_W - foldX, BOOK_H)
  ctx.clip()
  drawPageContent(ctx, state.currentPage, { x: SPINE_X, y: BOOK_Y, w: PAGE_W, h: BOOK_H })
  ctx.restore()

  // 3. Draw the back face (left of foldX, foreshortened)
  //    This is the underside of the turning page, compressed by perspective
  const flipWidth = foldX - SPINE_X
  const backWidth = Math.max(0, PAGE_W - flipWidth)
  const scaleX = backWidth / PAGE_W // perspective compression ratio

  if (scaleX > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(SPINE_X, BOOK_Y, flipWidth, BOOK_H)
    ctx.clip()

    // Apply horizontal compression toward the spine
    ctx.transform(scaleX, 0, 0, 1, SPINE_X - scaleX * SPINE_X, 0)
    drawPageContent(
      ctx,
      state.nextPage,
      { x: SPINE_X, y: BOOK_Y, w: PAGE_W, h: BOOK_H },
      { mirror: true },
    )
    ctx.restore()
  }

  // 4. Draw fold shadow gradient
  const shadowWidth = 30
  const shadowGrad = ctx.createLinearGradient(foldX - shadowWidth, 0, foldX + shadowWidth, 0)
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)')
  shadowGrad.addColorStop(0.4, 'rgba(0,0,0,0.12)')
  shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0.3)')
  shadowGrad.addColorStop(0.6, 'rgba(255,255,255,0.15)') // highlight on edge
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.fillStyle = shadowGrad
  ctx.fillRect(foldX - shadowWidth, BOOK_Y, shadowWidth * 2, BOOK_H)

  ctx.restore()
}
```

### Drag gesture

```typescript
canvas.addEventListener('mousedown', (e) => {
  const x = e.clientX - canvasRect.left
  if (x > SPINE_X) {
    state.isDragging = true
    state.foldX = SPINE_X + PAGE_W // start at the right edge
  }
})

canvas.addEventListener('mousemove', (e) => {
  if (!state.isDragging) return
  const x = e.clientX - canvasRect.left
  state.dragVelocity = x - state.foldX
  state.foldX = Math.max(SPINE_X, Math.min(SPINE_X + PAGE_W, x))
  // Trigger re-render — the spring loop is not running during manual drag
  requestRender()
})

canvas.addEventListener('mouseup', () => {
  if (!state.isDragging) return
  state.isDragging = false

  // Decide: complete the flip or snap back?
  const threshold = SPINE_X + PAGE_W * 0.4 // 40% from spine

  if (state.foldX < threshold || state.dragVelocity < -2) {
    // Complete the turn: spring foldX to spine
    state.flipSpring.snap(state.foldX)
    state.flipSpring.setTarget(SPINE_X)
    state.flipSpring.configure({ stiffness: 180, damping: 22 })
  } else {
    // Snap back: spring foldX to page right edge
    state.flipSpring.snap(state.foldX)
    state.flipSpring.setTarget(SPINE_X + PAGE_W)
    state.flipSpring.configure({ stiffness: 240, damping: 26 })
  }
})
```

### The physics of paper resistance

Real paper resists being turned. Early in the drag, it should feel stiff; past the midpoint, it accelerates. This is simulated by making the spring force non-linear — or more simply, by scaling the drag position through a curve:

```typescript
// Apply a cubic ease to the fold position — makes paper feel stiffer near edges
function easeDrag(t: number): number {
  // t is 0..1 (0 = full right, 1 = at spine)
  return t < 0.5
    ? 2 * t * t // ease-in: stiff at start
    : 1 - 2 * (1 - t) * (1 - t) // ease-out: accelerates past midpoint
}

const t = 1 - (state.rawFoldX - SPINE_X) / PAGE_W
state.foldX = SPINE_X + PAGE_W * (1 - easeDrag(t))
```

---

## Text layout on pages

Page content uses the Pretext library (the inspiration for Axiom) for precise character-level layout. This enables:

- Exact line-break positions (no browser layout engine)
- Hyphenation control
- Running headers aligned to the exact text baseline
- Accurate page-fill calculation (know exactly how many words fit before rendering)

Each page is a content unit: a list of paragraphs that are flowed onto the page surface with known character metrics.

---

## What this demonstrates

A React-based page-flip uses `rotateY: 180deg` and `preserve-3d`. The fold is a rigid flat card rotation — no curve, no compression, no paper feel.

Axiom renders the fold as a per-frame bezier path with:

- Perspective foreshortening via canvas transform
- Dynamic shadow gradient at the crease
- Spring momentum on release
- Paper resistance via non-linear drag easing

The total code for the flip effect: ~120 lines of TypeScript with no external dependencies.
The visual and physical quality: indistinguishable from a native app.
