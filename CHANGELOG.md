# Changelog

All notable changes to the **Axiom scene JSON contract** and the published API are documented here. Scene `formatVersion` bumps only for **breaking** changes to fields LLMs or tools must emit.

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
