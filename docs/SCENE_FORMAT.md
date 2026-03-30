# Scene Format Reference

The complete TypeScript type definitions for an Axiom scene, with field-by-field documentation.

---

## `Scene`

The root object. Everything about the visual state of the UI lives here.

```typescript
type Scene = {
  background?:         Color              // base fill color for the canvas
  backgroundGradient?: BackgroundGradient // optional radial gradient overlay
  nodes:               SceneNode[]        // all top-level nodes, rendered in order
}
```

**Render order**: nodes are rendered index-0 first (bottommost) to index-N last (topmost).

---

## `BackgroundGradient`

A radial gradient drawn over the background color, from the center outward.

```typescript
type BackgroundGradient = {
  cx:   number  // horizontal center, 0..1 fraction of viewport width
  cy:   number  // vertical center, 0..1 fraction of viewport height
  r:    number  // radius, 0..1 fraction of max(viewportWidth, viewportHeight)
  from: Color   // inner color (center)
  to:   Color   // outer color (edge)
}
```

Example — subtle blue-dark glow centered on screen:
```json
{ "cx": 0.5, "cy": 0.5, "r": 0.7, "from": "#0D0D22", "to": "#060608" }
```

---

## `SceneNode`

A discriminated union. Every node has a `type` field.

```typescript
type SceneNode = RectNode | TextNode | CircleNode | LineNode | GroupNode
```

### Fields shared by all node types (`BaseProps`)

```typescript
type BaseProps = {
  id:           string    // unique ID — used for springs, hit testing, accessibility
  x:            number    // position from parent's top-left (or viewport origin for root nodes)
  y:            number
  opacity?:     number    // [0, 1] — multiplied with parent opacity, default 1
  interactive?: boolean   // participates in mouse hit testing if true
  cursor?:      Cursor    // CSS cursor when hovered
  children?:   SceneNode[] // children rendered relative to this node's position
}
```

---

## `RectNode`

```typescript
type RectNode = BaseProps & {
  type:     'rect'
  width:    number
  height:   number
  fill?:    Color
  stroke?:  Stroke
  radius?:  number    // border-radius in px, default 0
  shadows?: Shadow[]
}
```

Shadow behavior: when the node is spring-animated upward (negative dy offset), the first shadow in the array automatically deepens — blur increases by `2.5 × rise`, y-offset increases by `0.5 × rise`. This produces the physical effect of a surface lifting away from a light source.

---

## `TextNode`

```typescript
type TextNode = BaseProps & {
  type:        'text'
  content:     string
  font:        FontSpec    // Canvas 2D font string: "700 18px Inter"
  fill:        Color
  align?:      'left' | 'center' | 'right'   // default 'left'
  baseline?:   Baseline                       // default 'alphabetic'
  maxWidth?:   number      // word-wrap if content exceeds this width
  lineHeight?: number      // required when maxWidth is set
}
```

**Font format** — identical to the Canvas 2D `ctx.font` property:
```
"[style] [weight] [size]px [family], [fallback]"

Examples:
  "700 18px Inter"
  "400 14px 'SF Pro Text', Inter, system-ui, sans-serif"
  "italic 600 16px Georgia, serif"
```

**Baseline guide:**
- `'top'` — y is the top of the tallest glyph. Best for positioned text inside containers.
- `'middle'` — y is the vertical midpoint. Best for vertically-centered labels in bars.
- `'alphabetic'` — y is the text baseline (Canvas default). Avoid unless necessary.
- `'bottom'` — y is the bottom of the descenders.

---

## `CircleNode`

```typescript
type CircleNode = BaseProps & {
  type:     'circle'
  radius:   number    // circle radius in px
  fill?:    Color
  stroke?:  Stroke
  shadows?: Shadow[]
}
```

`x, y` refer to the **center** of the circle, not its top-left corner.

---

## `LineNode`

```typescript
type LineNode = BaseProps & {
  type:   'line'
  dx:     number   // endpoint x, relative to (x, y)
  dy:     number   // endpoint y, relative to (x, y)
  stroke: Stroke
}
```

The line runs from `(x, y)` to `(x + dx, y + dy)`.

Horizontal divider example:
```json
{ "id": "hr", "type": "line", "x": 20, "y": 80, "dx": 360, "dy": 0,
  "stroke": { "color": "rgba(255,255,255,0.08)", "width": 1 } }
```

---

## `GroupNode`

```typescript
type GroupNode = BaseProps & {
  type:         'group'
  children:     SceneNode[]
  clipWidth?:   number   // if set, clips children to this rect
  clipHeight?:  number
}
```

A group has no visual representation of its own. It establishes a new coordinate origin for its children. Use groups to:
- Move a collection of nodes together
- Apply spring animation to a logical unit
- Clip a scrolling region (`clipWidth` + `clipHeight`)

---

## Supporting types

### `Color`

Any CSS color string:
```typescript
type Color = string

// Examples:
"#0C0C1A"
"rgba(0, 0, 0, 0.7)"
"rgba(255,255,255,0.06)"
"hsl(240, 40%, 8%)"
"transparent"
```

### `FontSpec`

Canvas 2D font string:
```typescript
type FontSpec = string  // "700 18px Inter"
```

### `Stroke`

```typescript
type Stroke = {
  color: Color
  width: number
  dash?: number[]  // e.g. [4, 4] — 4px dash, 4px gap
}
```

### `Shadow`

```typescript
type Shadow = {
  x:     number   // horizontal offset (positive = right)
  y:     number   // vertical offset (positive = down)
  blur:  number   // blur radius in px
  color: Color
}
```

### `Cursor`

```typescript
type Cursor =
  | 'default' | 'pointer' | 'grab' | 'grabbing'
  | 'crosshair' | 'text' | 'ns-resize' | 'ew-resize' | 'none'
```

### `SpringConfig`

```typescript
type SpringConfig = {
  stiffness: number   // spring constant k, typical range 80–600
  damping:   number   // damping coefficient b, typical range 10–35
  mass?:     number   // default 1
}
```

---

## Complete example: marketing hero section

A wordmark, tagline, and three feature cards. Viewport: 1440 × 900.

```
Layout math:
  CARD_W   = 300,  CARD_H  = 210,  CARD_GAP = 28
  ROW_W    = 300 * 3 + 28 * 2 = 956
  ROW_X    = (1440 - 956) / 2 = 242
  ROW_Y    = 900 / 2 - 40 = 410

  card[0].x = 242
  card[1].x = 242 + 300 + 28 = 570
  card[2].x = 242 + 2*(300 + 28) = 898

  Wordmark centered: x = 1440/2 = 720, y = 410 - 110 = 300
  Tagline:           x = 720, y = 300 + 50 = 350
```

```json
{
  "background": "#060608",
  "backgroundGradient": { "cx": 0.5, "cy": 0.5, "r": 0.7, "from": "#0D0D22", "to": "#060608" },
  "nodes": [
    {
      "id": "wordmark",
      "type": "text",
      "x": 720, "y": 300,
      "content": "AXIOM",
      "font": "800 46px 'SF Pro Display', Inter, system-ui, sans-serif",
      "fill": "#DCDCF0",
      "align": "center",
      "baseline": "middle"
    },
    {
      "id": "tagline",
      "type": "text",
      "x": 720, "y": 350,
      "content": "Mathematical UI  ·  Physics-First  ·  LLM-Authored",
      "font": "400 12px 'SF Pro Text', Inter, system-ui, sans-serif",
      "fill": "#26263A",
      "align": "center",
      "baseline": "middle"
    },
    {
      "id": "card-0",
      "type": "rect",
      "x": 242, "y": 410,
      "width": 300, "height": 210,
      "fill": "#0C0C1A",
      "radius": 14,
      "stroke": { "color": "rgba(255,255,255,0.07)", "width": 1 },
      "shadows": [{ "x": 0, "y": 10, "blur": 44, "color": "rgba(0,0,0,0.7)" }],
      "interactive": true,
      "cursor": "pointer",
      "children": [
        { "id": "card-0-accent", "type": "rect", "x": 20, "y": 22, "width": 28, "height": 3, "radius": 2, "fill": "#4F8EF7" },
        { "id": "card-0-title",  "type": "text",  "x": 20, "y": 44, "content": "Coordinate Native", "font": "600 15px Inter, system-ui", "fill": "#DCDCF0", "baseline": "top" },
        { "id": "card-0-desc",   "type": "text",  "x": 20, "y": 74, "content": "Every element has an exact position in 2D space. No layout engine. No cascade. Math all the way down.", "font": "400 13px Inter, system-ui", "fill": "#3A3A56", "baseline": "top", "maxWidth": 260, "lineHeight": 21 }
      ]
    }
  ]
}
```

Interactions:
```
card-0, card-1, card-2:
  mouseenter → spring(dy: -10, { stiffness: 320, damping: 24 })
  mouseleave → spring(dy: 0,   { stiffness: 320, damping: 24 })
  mousedown  → spring(dy: -4,  { stiffness: 460, damping: 30 })
  mouseup    → spring(dy: -10, { stiffness: 320, damping: 24 })
```
