# Changelog

All notable changes to the **Axiom scene JSON contract** and the published API are documented here. Scene `formatVersion` bumps only for **breaking** changes to fields LLMs or tools must emit.

## [0.3.0] — 2026-04-05

### Added

- [docs/VISION_AND_LIMITS.md](docs/VISION_AND_LIMITS.md) — product scope, Tier A/B/C (springs vs `fx` vs WebGL/engines).
- [docs/PROMPT_WATER_CLOCK.md](docs/PROMPT_WATER_CLOCK.md) — LLM prompt for Tier B ripple + HUD.
- **`axiom/fx`:** [`RippleSurface2D`](src/fx/ripple-surface.ts), [`DropMetronome`](src/fx/scheduled-drop.ts).
- [`src/demos/water-clock-demo.ts`](src/demos/water-clock-demo.ts) — `?demo=water`; CPU ripple via `Runtime.setRenderHooks({ afterBackground })`.
- **`RenderHooks.afterBackground`** on [`render()`](src/renderer.ts) and **`Runtime.setRenderHooks`**.

### Changed

- Renderer accepts optional hooks so effects can paint **under** scene nodes without fake z-order tricks.

## [0.2.2] — 2026-04-05

### Added

- [docs/HYBRID_UI.md](docs/HYBRID_UI.md) — when to use canvas/Axiom vs HTML/CSS, hybrid patterns, and common canvas-only pitfalls (transparency vs z-order).

### Changed

- [docs/LLM_PRIMER.md](docs/LLM_PRIMER.md) — section on **draw order, transparency, and clipping**.
- [docs/PROMPT_EXAMPLE_WATER_TIMER.md](docs/PROMPT_EXAMPLE_WATER_TIMER.md) — rewritten with stricter anti-chaos rules (opaque hits, one primary control, bounded decorations).

## [0.2.1] — 2026-04-05

### Added

- MIT `LICENSE`, `CONTRIBUTING.md`, Prettier + `.editorconfig`, `npm run format` / `npm run check`.
- [docs/PROMPT_EXAMPLE_WATER_TIMER.md](docs/PROMPT_EXAMPLE_WATER_TIMER.md) — copy-paste LLM prompt for a “Rain Timer” demo (water drops + springs + Pretext).

## [0.2.0] — 2026-04-05

### Added

- `Scene.formatVersion` (optional; default `1`) — version stamp for the JSON contract.
- `TextNode.textLayout`: `'canvas' | 'pretext'`. When `'pretext'`, wrapping uses `@chenglou/pretext` (requires `maxWidth` and `lineHeight`).
- `src/pretext-layout.ts` — prepare/layout cache and canvas drawing helpers.
- `src/kit/` — `card`, `button`, `textBlock` scene builders for LLM-oriented composition.
- Demos: `editorial` (animated reflow + springs), `dense` (many Pretext labels + hover springs). Query: `?demo=editorial` or `?demo=dense` (see README).

### Changed

- Package prepared for library use: `exports` in `package.json`, `private: false`.

## [0.1.0] — Initial

- Canvas scene graph, springs, hit testing, docs (`LLM_PRIMER`, `SCENE_FORMAT`).
