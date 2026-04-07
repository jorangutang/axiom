# Axiom

**Mathematical UI. Physics-first. LLM-authored.**

Axiom is a canvas-based UI rendering platform where every element has an exact coordinate, every animation is a spring equation, and the entire interface is described as pure data. No CSS. No DOM layout. No component tree.

Multiline typography can use [**Pretext**](https://www.npmjs.com/package/@chenglou/pretext) (`textLayout: "pretext"`) for DOM-free measurement and line breaking on the same canvas draw path.

```bash
cd axiom && npm install && npm run dev
```

**Demos (query string):**

- Default: **book** — page-flip showcase (`src/book-demo.ts`).
- `?demo=editorial` — card width oscillates; Pretext body reflows every frame + hover springs.
- `?demo=dense` — many labeled cells with Pretext + hover lift.
- `?demo=water` — CPU ripple pool (`axiom/fx`) + HUD springs; see [docs/PROMPT_WATER_CLOCK.md](docs/PROMPT_WATER_CLOCK.md).

---

## For LLMs and tools

1. Read [docs/LLM_PRIMER.md](docs/LLM_PRIMER.md) before generating scenes.
2. Follow [docs/SCENE_FORMAT.md](docs/SCENE_FORMAT.md) for the full type contract.
3. Set `"formatVersion": 1` on scenes (or omit; default is `1`). Breaking JSON changes are recorded in [CHANGELOG.md](CHANGELOG.md).

**Example build prompt:** [docs/PROMPT_EXAMPLE_WATER_TIMER.md](docs/PROMPT_EXAMPLE_WATER_TIMER.md) — “Rain Timer” (tighter rules so layouts stay legible).

**Canvas vs DOM:** [docs/HYBRID_UI.md](docs/HYBRID_UI.md) — when Axiom fits, when to use HTML/CSS or a hybrid.

**Vision and limits (springs vs simulation):** [docs/VISION_AND_LIMITS.md](docs/VISION_AND_LIMITS.md) — Tier A/B/C, what `fx` provides vs WebGL/engines.

**Handoff for another agent:** [docs/AGENT_HANDOFF_PROMPT.md](docs/AGENT_HANDOFF_PROMPT.md) — gaps, research, usability (copy-paste prompt).

---

## npm package (library)

The repo builds an ESM bundle to `dist-lib/` (`npm run build:lib`). Subpath exports:

| Import                 | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `axiom`                | Types, renderer, runtime, physics, hittest, pretext helpers, kit |
| `axiom/kit`            | `card`, `button`, `textBlock`, `kitTheme`                        |
| `axiom/pretext-layout` | Pretext prepare cache + line layout helpers                      |
| `axiom/fx`             | `RippleSurface2D`, `DropMetronome` (Tier B CPU effects)          |

After `npm run build:lib`, consumers can depend on this package from git or npm. `prepublishOnly` runs the library build.

### Usage

```ts
// Core: Runtime, renderer, types
import { Runtime } from 'axiom'
import type { Scene } from 'axiom'

const canvas = document.querySelector('canvas') as HTMLCanvasElement
const runtime = new Runtime(canvas)

const scene: Scene = {
  background: '#1a1a2e',
  nodes: [
    {
      type: 'rect',
      id: 'card',
      x: 40,
      y: 40,
      width: 200,
      height: 120,
      fill: '#16213e',
      radius: 12,
      interactive: true,
      cursor: 'pointer',
    },
  ],
}

runtime.setScene(scene)

// Spring-animate on hover
runtime.on('mouseenter', (e) => runtime.spring(e.id, { dx: 0, dy: -6 }))
runtime.on('mouseleave', (e) => runtime.spring(e.id, { dx: 0, dy: 0 }))
```

```ts
// Kit: pre-built component builders
import { button, card, kitTheme } from 'axiom/kit'

const nodes = [
  ...card({ id: 'c', x: 20, y: 20, width: 240, height: 160, title: 'Hello', body: 'World' }),
  ...button({ id: 'btn', x: 40, y: 140, width: 120, height: 36, label: 'Click me' }),
]
```

```ts
// Pretext: DOM-free text layout with i18n-quality line breaking
import { getPreparedText, layoutLinesForCanvas } from 'axiom/pretext-layout'
```

```ts
// FX: CPU ripple effects (Tier B)
import { RippleSurface2D, DropMetronome } from 'axiom/fx'

const surface = new RippleSurface2D(64, 64)

runtime.setRenderHooks({
  afterBackground(ctx, viewport) {
    surface.step()
    surface.drawInto(ctx, 0, 0, viewport.width, viewport.height)
  },
})

runtime.on('click', (e) => {
  surface.impulse(e.x / viewport.width, e.y / viewport.height, 200)
})
```

See [docs/FX_API.md](docs/FX_API.md) for full `RippleSurface2D` and `DropMetronome` reference.
See [docs/HITTEST.md](docs/HITTEST.md) for hit testing rules and debugging.
See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues.

---

## The problem with the current stack

The web's rendering pipeline was designed for documents. CSS describes rules; the browser discovers positions. React manages DOM mutations. Each layer is an escape hatch from the previous layer's problems.

By the time a button appears on screen it has passed through layout, paint, and composite. The layout engine is a black box for reasoning and for LLMs that must emit precise UI.

---

## The Axiom approach

```
Natural language description
         ↓
    LLM generates
         ↓
    Scene JSON  ← explicit coordinates, spring configs, interactions
         ↓
  Axiom Runtime
    ├─ Hit test engine (replaces DOM event bubbling)
    └─ Spring physics (replaces CSS transitions)
         ↓
  Canvas 2D
         ↓
      Pixels
```

**A scene is pure JSON.** The browser runs JavaScript, forwards pointer events, and draws pixels.

**Springs replace transitions.** Change targets mid-animation without fighting transition CSS.

**LLMs are the intended author.** Coordinates and layout arithmetic are explicit; optional Pretext improves text when `textLayout` is `"pretext"`.

---

## Project structure

```
axiom/
├── src/
│   ├── types.ts           Scene contract (LLM output)
│   ├── renderer.ts        Canvas 2D draw
│   ├── pretext-layout.ts  Pretext prepare cache + line drawing
│   ├── hittest.ts
│   ├── physics.ts
│   ├── runtime.ts         RAF, springs, input, `setFrameCallback` for demos
│   ├── kit/               card, button, textBlock builders
│   ├── fx/                CPU ripple + drop metronome (Tier B)
│   ├── demos/             editorial, dense, water-clock
│   ├── book-demo.ts
│   └── main.ts            Boots demo from `?demo=`
├── docs/
│   ├── LLM_PRIMER.md
│   ├── SCENE_FORMAT.md
│   ├── PHYSICS.md
│   ├── BOOK_EXAMPLE.md
│   ├── PROMPT_EXAMPLE_WATER_TIMER.md   Rain Timer prompt (simplified UX rules)
│   ├── PROMPT_WATER_CLOCK.md           ripple + HUD prompt (Tier B fx)
│   ├── HYBRID_UI.md                    canvas vs traditional UI decision guide
│   ├── VISION_AND_LIMITS.md            springs vs simulation tiers
│   ├── HITTEST.md                      hit testing rules, geometry, debugging
│   ├── FX_API.md                       RippleSurface2D + DropMetronome API
│   ├── TROUBLESHOOTING.md              common issues and fixes
│   └── AGENT_HANDOFF_PROMPT.md         prompt for assess + continue work
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── index.html
```

---

## Scripts

- `npm run dev` — Vite dev server.
- `npm run build` — `build:lib`, typecheck, production Vite build.
- `npm run build:lib` — emit `dist-lib/` + declarations for publishing.
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` — Vitest (Pretext tests stub `OffscreenCanvas` in Node).
- `npm run format` / `npm run format:check` — Prettier.
- `npm run check` — format check, typecheck, and tests.

See [CONTRIBUTING.md](CONTRIBUTING.md) for PR expectations.

---

## Roadmap (selected)

- Expression evaluator for viewport-relative numeric expressions in JSON.
- WebGPU / richer materials.
- Accessibility and hybrid DOM strategies for forms and screen readers where canvas-only is not enough.
