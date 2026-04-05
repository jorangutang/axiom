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

---

## For LLMs and tools

1. Read [docs/LLM_PRIMER.md](docs/LLM_PRIMER.md) before generating scenes.
2. Follow [docs/SCENE_FORMAT.md](docs/SCENE_FORMAT.md) for the full type contract.
3. Set `"formatVersion": 1` on scenes (or omit; default is `1`). Breaking JSON changes are recorded in [CHANGELOG.md](CHANGELOG.md).

**Example build prompt:** [docs/PROMPT_EXAMPLE_WATER_TIMER.md](docs/PROMPT_EXAMPLE_WATER_TIMER.md) — “Rain Timer” (water drops, clever duration UX, Pretext, springs). Copy the fenced block into your LLM.

---

## npm package (library)

The repo builds an ESM bundle to `dist-lib/` (`npm run build:lib`). Subpath exports:

| Import                 | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `axiom`                | Types, renderer, runtime, physics, hittest, pretext helpers, kit |
| `axiom/kit`            | `card`, `button`, `textBlock`, `kitTheme`                        |
| `axiom/pretext-layout` | Pretext prepare cache + line layout helpers                      |

After `npm run build:lib`, consumers can depend on this package from git or npm. `prepublishOnly` runs the library build.

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
│   ├── demos/             editorial + dense showcases
│   ├── book-demo.ts
│   └── main.ts            Boots demo from `?demo=`
├── docs/
│   ├── LLM_PRIMER.md
│   ├── SCENE_FORMAT.md
│   ├── PHYSICS.md
│   ├── BOOK_EXAMPLE.md
│   └── PROMPT_EXAMPLE_WATER_TIMER.md   example LLM prompt (Rain Timer)
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
