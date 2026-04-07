# Axiom FX API

`axiom/fx` provides **Tier B** visual effects: CPU-based simulation that runs alongside the spring-animated scene. These are visual flourishes, not physics engines. See `docs/VISION_AND_LIMITS.md` for the Tier taxonomy.

```ts
import { RippleSurface2D, DropMetronome } from 'axiom/fx'
```

---

## RippleSurface2D

A discrete 2D wave equation solved on a CPU grid. Suitable for "water surface" visuals rendered under a UI layer. Not fluid dynamics — the wave equation propagates energy but does not simulate flow, pressure, or viscosity.

### Constructor

```ts
new RippleSurface2D(cols: number, rows: number, options?: RippleSurfaceOptions)
```

| Parameter         | Type     | Description                                                                          |
| ----------------- | -------- | ------------------------------------------------------------------------------------ |
| `cols`            | `number` | Grid width in cells. Minimum 4.                                                      |
| `rows`            | `number` | Grid height in cells. Minimum 4.                                                     |
| `options.damping` | `number` | Energy retained per step, `0`–`1`. Default `0.988`. Higher = longer-lasting ripples. |

Throws if `cols < 4` or `rows < 4`.

**Memory:** Three `Float32Array` buffers of `cols × rows` floats. A 64 × 64 grid uses ~48 KB; a 128 × 128 grid uses ~192 KB.

### Methods

#### `step(): void`

Integrate one timestep of the wave equation. Call once per animation frame (inside `setFrameCallback` or `setRenderHooks.afterBackground`).

The wave propagates using a finite-difference scheme:

```
uNext[i] = (sum of 4 neighbours × 0.5 − uPrev[i]) × damping
```

Border cells are zeroed each step (absorbing boundary conditions — waves disappear at edges rather than reflect).

#### `impulse(nx, ny, strength): void`

Add energy at a normalised position.

| Parameter  | Type     | Description                                                                                                                                                              |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nx`       | `number` | Horizontal position, `0`–`1` (left → right).                                                                                                                             |
| `ny`       | `number` | Vertical position, `0`–`1` (top → bottom).                                                                                                                               |
| `strength` | `number` | Energy magnitude. Try `80`–`400` for visible ripples. The center cell receives full strength; the four immediate neighbours receive 35% each for a smooth initial pulse. |

#### `clear(): void`

Zero all internal buffers. Instantly removes all ripples.

#### `drawInto(ctx, destX, destY, destW, destH): void`

Rasterise the current heightfield into the canvas at the given CSS-pixel rectangle.

| Parameter        | Type                       | Description                                  |
| ---------------- | -------------------------- | -------------------------------------------- |
| `ctx`            | `CanvasRenderingContext2D` | The canvas context (Axiom viewport context). |
| `destX`, `destY` | `number`                   | Top-left corner in CSS pixels.               |
| `destW`, `destH` | `number`                   | Destination dimensions in CSS pixels.        |

The heightfield is peak-normalised before rendering. Colour maps from deep blue (trough) to bright cyan (crest) with partial transparency. The scratch canvas is created on first call and reused.

No-op if `document` is not available (SSR / Node environments).

### Properties

| Property | Type              | Description                            |
| -------- | ----------------- | -------------------------------------- |
| `cols`   | `readonly number` | Grid width passed to the constructor.  |
| `rows`   | `readonly number` | Grid height passed to the constructor. |

### Performance Budget

Grid size is the primary performance lever. Step time scales as `O(cols × rows)`.

| Grid      | Cells  | Approx step time (modern desktop) | Notes                                          |
| --------- | ------ | --------------------------------- | ---------------------------------------------- |
| 32 × 32   | 1 024  | < 0.1 ms                          | Very fast; low detail                          |
| 64 × 64   | 4 096  | ~0.1 ms                           | Default recommendation                         |
| 128 × 128 | 16 384 | ~0.5 ms                           | Fine detail; measure on target device          |
| 256 × 256 | 65 536 | ~2 ms+                            | May crowd the frame budget on mid-range mobile |

At 60 fps the total frame budget is ~16.7 ms. Leave at least 8–10 ms for rendering. Start at 64 × 64 and increase only if you need visible fine detail.

### Usage Pattern

Wire the ripple surface into the render loop via `setRenderHooks`:

```ts
import { Runtime } from 'axiom'
import { RippleSurface2D, DropMetronome } from 'axiom/fx'

const surface = new RippleSurface2D(64, 64, { damping: 0.988 })

runtime.setRenderHooks({
  afterBackground(ctx, viewport) {
    surface.step()
    surface.drawInto(ctx, 0, 0, viewport.width, viewport.height)
  },
})

// Add ripples on click
runtime.on('click', (e) => {
  const nx = e.x / viewport.width
  const ny = e.y / viewport.height
  surface.impulse(nx, ny, 200)
})
```

---

## DropMetronome

A fixed-interval timer that fires a callback on every elapsed interval. Intended for periodic visual impulses (e.g., rain drops) or timed logic. Independent of spring physics.

### Constructor

```ts
new DropMetronome(options: DropMetronomeOptions)
```

| Option        | Type                      | Description                                               |
| ------------- | ------------------------- | --------------------------------------------------------- |
| `intervalSec` | `number`                  | Seconds between drops. Minimum enforced: `0.05 s`.        |
| `onDrop`      | `(index: number) => void` | Called each time an interval elapses. `index` is 1-based. |

### Methods

#### `tick(dt: number): void`

Advance the metronome clock by `dt` seconds. Call from `setFrameCallback`. Fires `onDrop` for every complete interval that has elapsed (handles frame-rate spikes without skipping ticks).

#### `setIntervalSec(sec: number): void`

Update the interval at runtime. The new value takes effect immediately. Clamped to a minimum of `0.05 s`.

#### `reset(): void`

Zero the accumulator and drop count. `onDrop` will not fire until a full interval elapses again.

### Properties

| Property    | Type              | Description                                             |
| ----------- | ----------------- | ------------------------------------------------------- |
| `dropCount` | `readonly number` | Total drops fired since construction or last `reset()`. |

### Usage Pattern

```ts
import { DropMetronome, RippleSurface2D } from 'axiom/fx'

const surface = new RippleSurface2D(64, 64)
const metro = new DropMetronome({
  intervalSec: 1.2,
  onDrop() {
    // Random drop position
    surface.impulse(Math.random(), Math.random(), 150)
  },
})

runtime.setFrameCallback((scene, dt) => {
  metro.tick(dt)
  // scene mutations here...
})
```

---

## Combining RippleSurface2D and DropMetronome

The water-clock demo (`src/demos/water-clock-demo.ts`) shows the canonical pattern:

1. `DropMetronome` fires periodic impulses into `RippleSurface2D` from `setFrameCallback`.
2. `setRenderHooks.afterBackground` steps and draws the surface under scene nodes each frame.
3. Interactive buttons call `surface.impulse()` directly on click for immediate feedback.
