# Axiom Troubleshooting

---

## Springs

### My spring overshoots and keeps bouncing

Your `damping` is too low relative to `stiffness`. The critical damping threshold is `2 × √(stiffness × mass)`.

```
stiffness: 200  →  critical damping ≈ 2 × √200 ≈ 28.3
```

To eliminate overshoot: set `damping >= 28`. For `stiffness: 400`: `damping >= 40`.

The built-in presets are all tuned to be perceptually pleasant. If a custom config feels wrong, start from a preset and adjust:

| Feel    | stiffness | damping      |
| ------- | --------- | ------------ |
| Snappy  | 400       | 28           |
| Default | 200       | 20           |
| Gentle  | 120       | 18           |
| Bouncy  | 200       | 10           |
| Heavy   | 100       | 14 (mass: 2) |

### My animation loop never stops (RAF runs forever)

A spring that never settles holds the RAF loop open. This happens when `damping` is extremely low (close to 0) or when `target` is changing every frame (e.g., chasing a mouse position).

Check `runtime.spring(id, ...)` calls inside `setFrameCallback`: calling this every frame with a new target keeps the spring permanently active.

For position-following (e.g., parallax), this is expected — the loop should be continuous. Use `setFrameCallback` deliberately.

### Spring animation starts from the wrong position

`runtime.spring()` always starts from the node's current offset, not from its scene JSON position. If you `setScene()` and then immediately call `spring()`, the offset is zero and the animation begins from the scene coordinate. If you previously spring-displaced the node and then call `spring()` with a new target, it continues from the displaced position.

To reset a node to its base position with animation: `runtime.spring(id, { dx: 0, dy: 0 })`.

To teleport without animation: modify the scene JSON's `x`/`y` directly and call `setScene()`.

### Calling `Spring2D.step()` only animates the x axis

This was a bug in v0.3.0 where `Spring2D.step()` used short-circuit `||`, causing `y.step()` to never execute while `x` was still moving. Fixed in v0.3.1+. Update your package.

---

## Hit Testing

### A node isn't receiving mouse events

1. **Missing `interactive: true`** — the default is `undefined` (falsy). Set it explicitly.
2. **Covered by another node** — a later (higher-z) `interactive` node above it is capturing the event. Check array order in `nodes`.
3. **Spring displacement** — if the node is spring-animated, its hit zone moves with it. The original coordinates are no longer active during animation.
4. **Group without clip** — groups are never directly hittable without `clipWidth`/`clipHeight`. Children are still hittable.
5. **Text node without `maxWidth`/`lineHeight`** — text nodes only participate in hit testing when both are set. See `docs/HITTEST.md`.

To debug: temporarily add a semi-transparent `rect` at the same coordinates to visualise the expected hit zone.

### Clicks fire on the wrong node

Array order determines z-order. The last node in `nodes` is topmost and checked first. If two nodes overlap at the click point, the last one wins.

Reorder `nodes` so the intended target appears later in the array.

### Events fire on a parent when I click a child

Children are checked before parents, so this should not happen unless:

- The child is not `interactive: true`.
- The child's coordinates (which are relative to the parent) don't actually cover the click point.

Add the child's parent offset manually to verify: child hit zone = `(parent.x + child.x, parent.y + child.y, child.width, child.height)` plus any spring displacements.

---

## Rendering

### Text is blurry or pixel-doubled

You are not accounting for device pixel ratio (DPR). The Runtime handles DPR scaling for you — do not scale the canvas manually. If you're creating a canvas outside Runtime, scale it with:

```ts
canvas.width = viewport.width * devicePixelRatio
canvas.height = viewport.height * devicePixelRatio
ctx.scale(devicePixelRatio, devicePixelRatio)
```

### Text overflows its container

Axiom does not enforce `maxWidth` as a clip — it's a soft wrap hint for the renderer. If text overflows:

- Ensure `maxWidth` matches the container width.
- Use `textLayout: "pretext"` for more accurate line breaking (especially non-Latin text).
- Set a `clipWidth`/`clipHeight` on a parent `group` if hard clipping is required.

### Shadows don't appear

Shadows are only rendered on `rect` and `circle` nodes via the `shadows` array. The renderer uses `shadows[0]` (first shadow only — multi-shadow is not supported). Ensure the `shadows` array is non-empty and the `color` has non-zero alpha.

### The canvas is blank

Common causes:

- `scene.nodes` is empty or undefined.
- Node `opacity` is `0`.
- Node coordinates place it entirely outside the viewport.
- `scene.background` is set to the same colour as the nodes and there's no visible contrast.

---

## Pretext / Text Layout

### Pretext text isn't rendering

`textLayout: "pretext"` requires both `maxWidth` **and** `lineHeight` to be set. If either is missing, Axiom silently falls back to canvas `measureText`. Check both fields are present.

Pretext also requires `@chenglou/pretext` to be installed as a dependency of your project.

### Pretext measurements seem stale after scene update

The Pretext layout cache is keyed on `(id, content, font)`. Changing any of these three fields invalidates the cache. The cache is fully cleared when `runtime.setScene()` is called.

If you are mutating the scene directly (e.g., in `setFrameCallback`) without calling `setScene`, the cache is not cleared automatically. Call `clearPretextLayoutCache()` manually from `axiom/pretext-layout` if content changes mid-session.

---

## TypeScript Errors

### `Type 'string' is not assignable to type 'SceneNode'`

`SceneNode` is a discriminated union — `type` is required and must be one of: `'rect' | 'text' | 'circle' | 'line' | 'group'`. Ensure each node object has a literal `type` field.

### `Property 'width' does not exist on type 'SceneNode'`

Narrow the union first: `if (node.type === 'rect') { node.width ... }`. TypeScript cannot infer geometry properties without narrowing.

### `Argument of type '{ ... }' is not assignable to parameter of type 'SpringConfig'`

`SpringConfig` requires both `stiffness` and `damping`. `mass` is optional. Ensure both required fields are present.

### Type errors on `GroupNode.children`

`GroupNode.children` is required (not optional). Other node types have `children?: SceneNode[]` (optional). Ensure `children` is always an array `[]` (not omitted) when constructing a `GroupNode`.

---

## FX / Ripple

### RippleSurface2D throws on construction

`cols` and `rows` must both be at least `4`. Values below 4 throw: `RippleSurface2D: cols and rows must be at least 4`.

### Ripples disappear immediately

`damping` is too low. Default is `0.988`. Values below `~0.95` cause very fast decay. Increase toward `0.99` for longer-lasting ripples.

### `drawInto` does nothing (SSR / test environments)

`drawInto` is a no-op when `document` is not defined. In Node.js tests, mock `document.createElement` or test `step()`/`impulse()` independently.

### DropMetronome fires too rarely

`intervalSec` is clamped to a minimum of `0.05 s`. Calling `tick(dt)` with very small `dt` values (e.g., paused tab) will accumulate without firing. On resume, all elapsed ticks fire in rapid succession — guard against this in `onDrop` if needed.
