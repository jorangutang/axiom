# LLM Primer: Generating Axiom Scenes

**Read this document completely before generating any scene.**

You are a language model generating an Axiom scene — a JSON object that describes a user interface as geometric primitives with explicit coordinates. The scene is rendered directly to a `<canvas>` element. There is no CSS. There is no DOM layout engine. Every element's position, size, and appearance is fully determined by the numbers you provide.

---

## Scene format version

- Set `"formatVersion": 1` on the root scene object (or omit it; default is `1`).
- If you integrate a tool or fine-tune on Axiom scenes, **pin** the format version you target.
- Breaking changes to the JSON shape are documented in **CHANGELOG.md** at the project root and bump the default format version.

---

## Draw order, transparency, and clipping

- **Order:** Within a `nodes` or `children` array, the **first** node is drawn **underneath**; the **last** is drawn **on top**. There is no separate `zIndex` field.
- **Transparency:** If you draw **decorations** (droplets, particles) and then draw **buttons** with **semi-transparent** fills (`rgba(..., 0.2)`), the decorations **show through** the buttons. That often looks like “physics on top of UI” even when the order is correct. Use **nearly opaque** fills for interactive surfaces, or put decorations in a **separate layer** that does not sit under interactive areas.
- **Clipping:** A `group` may set `clipWidth` and `clipHeight` so children do not paint outside a rectangle—useful to confine rain or sparkles to a header strip.
- **Hybrid apps:** For forms, accessibility, and SEO, prefer DOM for those parts and canvas for the custom layer. See [HYBRID_UI.md](HYBRID_UI.md).

---

## The coordinate system

- Origin `(0, 0)` is the **top-left corner** of the canvas
- `x` increases to the right
- `y` increases downward
- Units are CSS pixels (the runtime handles high-DPR displays)
- Viewport dimensions are `vw` (width) and `vh` (height) — variables you must calculate positions relative to

---

## The fundamental rule

**There is no layout engine. You calculate every position.**

If the browser's CSS layout engine were a calculator, Axiom is the raw equation. You are the calculator now.

### Example: centering three cards

```
CARD_W   = 300
CARD_H   = 210
CARD_GAP = 28
ROW_W    = CARD_W * 3 + CARD_GAP * 2     = 988
ROW_X    = (vw - ROW_W) / 2              = (vw - 988) / 2

card[0].x = ROW_X
card[1].x = ROW_X + CARD_W + CARD_GAP   = ROW_X + 328
card[2].x = ROW_X + 2 * (CARD_W + CARD_GAP) = ROW_X + 656
```

Always show your arithmetic. Calculate intermediate values. Then emit the resolved numbers into the JSON.

---

## Layout patterns

### Horizontal centering

```
element.x = (vw - element.width) / 2
```

### Vertical centering in a container

```
element.y = (container.height - element.height) / 2
```

### Right-aligned with margin

```
element.x = container.width - element.width - margin
```

### Vertically centered text in a bar

If the bar is 64px tall and you want text centered:

```
text.y = 32          (with baseline: 'middle')
```

### Equal-width columns (N columns, gap G, margin M on each side)

```
colWidth    = (vw - 2*M - (N-1)*G) / N
col[i].x    = M + i * (colWidth + G)
```

### Vertical stack (items with height H, spacing S, starting at startY)

```
item[n].y = startY + n * (H + S)
```

### Full-width element

```
element.width = vw
```

### Element pinned to bottom

```
element.y = vh - element.height - margin
```

---

## Node types reference

### `rect` — filled rectangle

```json
{
  "id": "card",
  "type": "rect",
  "x": 216,
  "y": 300,
  "width": 320,
  "height": 200,
  "fill": "#0C0C1A",
  "radius": 14,
  "stroke": { "color": "rgba(255,255,255,0.07)", "width": 1 },
  "shadows": [{ "x": 0, "y": 10, "blur": 44, "color": "rgba(0,0,0,0.7)" }],
  "interactive": true,
  "cursor": "pointer"
}
```

### `text` — rendered text

```json
{
  "id": "title",
  "type": "text",
  "x": 236,
  "y": 344,
  "content": "Hello World",
  "font": "700 18px Inter",
  "fill": "#DCDCF0",
  "align": "left",
  "baseline": "top"
}
```

Font format: `"[weight] [size]px [family]"` — exactly as Canvas 2D's `ctx.font`.
Common fonts: `Inter`, `SF Pro Display`, `system-ui`, `sans-serif`.

**Baseline guide:**

- `"top"` — y is the top of the text. Use for body text positioned within a container.
- `"middle"` — y is the vertical center. Use for labels that must be centered in a bar.
- `"alphabetic"` — y is the baseline (default Canvas behavior). Avoid unless you need precise baseline alignment.

**Multiline text** (provide both `maxWidth` and `lineHeight`):

```json
{
  "id": "body",
  "type": "text",
  "x": 236,
  "y": 374,
  "content": "A longer paragraph that will wrap automatically at the given max width.",
  "font": "400 14px Inter",
  "fill": "#44445A",
  "baseline": "top",
  "maxWidth": 280,
  "lineHeight": 22
}
```

**Pretext layout** (optional, for higher-quality wrapping and i18n): add `"textLayout": "pretext"` alongside `maxWidth` and `lineHeight`. The runtime uses `@chenglou/pretext` to break lines; still no DOM layout.

### `circle`

```json
{
  "id": "avatar",
  "type": "circle",
  "x": 260,
  "y": 320,
  "radius": 24,
  "fill": "#3B82F6",
  "stroke": { "color": "rgba(255,255,255,0.2)", "width": 1 }
}
```

Note: `x, y` are the circle's **center**, not its top-left.

### `line`

```json
{
  "id": "divider",
  "type": "line",
  "x": 24,
  "y": 80,
  "dx": 392,
  "dy": 0,
  "stroke": { "color": "rgba(255,255,255,0.06)", "width": 1 }
}
```

`dx, dy` are the endpoint relative to `(x, y)`.

### `group`

A container. Children's `x, y` are relative to the group's position. When the group moves (spring animation), all children move with it.

```json
{
  "id": "navbar",
  "type": "group",
  "x": 0,
  "y": 0,
  "children": [
    {
      "id": "nav-bg",
      "type": "rect",
      "x": 0,
      "y": 0,
      "width": 1440,
      "height": 64,
      "fill": "#0C0C1A"
    },
    {
      "id": "nav-logo",
      "type": "text",
      "x": 24,
      "y": 32,
      "content": "ACME",
      "font": "700 20px Inter",
      "fill": "#FFF",
      "baseline": "middle"
    }
  ]
}
```

---

## Children

Any node can have children. Children's `x, y` are relative to the parent node's **rendered position** (base position + spring offset). The parent visually contains the children — they move together.

```json
{
  "id": "card",
  "type": "rect",
  "x": 100,
  "y": 200,
  "width": 300,
  "height": 200,
  "fill": "#0C0C1A",
  "children": [
    {
      "id": "card-label",
      "type": "text",
      "x": 20,
      "y": 20,
      "content": "Title",
      "font": "700 16px Inter",
      "fill": "#FFF",
      "baseline": "top"
    }
  ]
}
```

---

## Visual design

### Color palette (dark UI)

```
Background deep:  #060608
Background mid:   #0C0C1A
Surface:          #0E0E1C
Card:             #101020
Border subtle:    rgba(255,255,255,0.06)
Border visible:   rgba(255,255,255,0.12)
Text primary:     #DCDCF0
Text secondary:   #44445A
Text muted:       #26263A
Accent blue:      #4F8EF7
Accent purple:    #9B72F8
Accent green:     #34D399
Accent amber:     #F59E0B
```

### Typography scale

```
Display:    "800 52px ..."   — hero headings, wordmarks
H1:         "700 36px ..."   — page titles
H2:         "700 24px ..."   — section headings
H3:         "600 18px ..."   — card titles, subheadings
Body:       "400 15px ..."   — main content
Small:      "400 13px ..."   — descriptions, secondary
Caption:    "400 11px ..."   — metadata, labels
```

### Shadow elevation scale

```
Flat:       no shadow
Raised:     { x:0, y:4,  blur:16, color:"rgba(0,0,0,0.4)" }
Floating:   { x:0, y:10, blur:40, color:"rgba(0,0,0,0.6)" }
Modal:      { x:0, y:20, blur:80, color:"rgba(0,0,0,0.7)" }
```

### Border radius scale

```
Small:    4px   — tags, badges, small buttons
Medium:   8px   — inputs, buttons
Large:    12px  — cards, panels
XL:       20px  — modals, large surfaces
Pill:     999px — use with explicit height for pill shapes
```

---

## Physics and interactions

Springs are specified in the interaction layer (separate from the scene JSON). When describing a scene, note the intended interactions alongside the JSON:

```
// Interactions for this scene:
// card-0, card-1, card-2:
//   mouseenter → spring(dy: -10, { stiffness: 320, damping: 24 })
//   mouseleave → spring(dy: 0,   { stiffness: 320, damping: 24 })
//   mousedown  → spring(dy: -4,  { stiffness: 460, damping: 30 })
//   mouseup    → spring(dy: -10, { stiffness: 320, damping: 24 })
```

### Spring parameter guide

| Feel    | Stiffness | Damping | Notes                           |
| ------- | --------- | ------- | ------------------------------- |
| Snappy  | 460       | 30      | Buttons, small elements         |
| Default | 320       | 24      | Card hover, standard UI         |
| Smooth  | 200       | 20      | Panels, drawers                 |
| Gentle  | 120       | 18      | Large surfaces, modals          |
| Bouncy  | 200       | 10      | Playful elements, notifications |
| Heavy   | 100       | 14      | Large heavy-feeling objects     |

### Common interaction patterns

**Card hover lift:**

```
mouseenter → dy: -10, stiffness: 320, damping: 24
mouseleave → dy: 0,   stiffness: 320, damping: 24
```

**Button press:**

```
mousedown → dy: +2,  stiffness: 460, damping: 30   (dips down)
mouseup   → dy: 0,   stiffness: 460, damping: 30   (springs back)
```

**Modal open:**

```
dy: springs from +20 → 0    (slides up into position)
opacity: springs from 0 → 1
stiffness: 200, damping: 20
```

**Drawer slide in from right:**

```
dx: springs from +vw → 0
stiffness: 180, damping: 22
```

---

## Accessibility tree

After generating the scene, also output an accessibility descriptor:

```json
{
  "accessibility": [
    { "id": "card-0", "role": "button", "label": "Coordinate Native — opens feature detail" },
    { "id": "nav-logo", "role": "link", "label": "Return to home" },
    { "id": "body-text", "role": "text", "label": "Main content paragraph" }
  ]
}
```

---

## Output format

When asked to generate a scene, output:

1. **Calculations** — show your layout math in comments
2. **Scene JSON** — the complete `Scene` object
3. **Interactions** — a description of spring targets per event
4. **Accessibility** — the accessibility descriptor

Always emit resolved numbers. Never leave arithmetic unresolved in the JSON.
