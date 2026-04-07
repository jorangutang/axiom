# Contributing

## Setup

```bash
npm install
```

## Checks before a PR

```bash
npm run check
```

This runs Prettier (check only), TypeScript `noEmit`, and Vitest.

## Build

- **App (Vite):** `npm run build` — produces `dist/` and runs `build:lib` first.
- **Library (npm consumers):** `npm run build:lib` — emits `dist-lib/` with `.d.ts`. Add to `.gitignore` locally; published packages include it via the `files` field and `prepublishOnly`.

## Code style

- Format with `npm run format` (Prettier).
- Scene JSON and public types: keep [docs/SCENE_FORMAT.md](docs/SCENE_FORMAT.md) in sync when changing [src/types.ts](src/types.ts).
- Document breaking scene changes in [CHANGELOG.md](CHANGELOG.md) and bump `formatVersion` when appropriate.

## LLM-authored examples

See [docs/PROMPT_EXAMPLE_WATER_TIMER.md](docs/PROMPT_EXAMPLE_WATER_TIMER.md) and [docs/PROMPT_WATER_CLOCK.md](docs/PROMPT_WATER_CLOCK.md) for example prompts, [docs/VISION_AND_LIMITS.md](docs/VISION_AND_LIMITS.md) for scope (springs vs `fx` vs engines), and [docs/HYBRID_UI.md](docs/HYBRID_UI.md) for canvas vs DOM boundaries.
