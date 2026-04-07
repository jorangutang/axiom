# Handoff prompt for assessing and continuing Axiom

Copy everything below the line into a new chat with your coding agent. Point it at this repository (or paste the repo URL and key paths).

---

## Context

**Axiom** is a TypeScript library for **canvas-first UI**: a JSON **scene graph**, **damped springs** for interaction motion ([`src/physics.ts`](src/physics.ts)), **Canvas 2D** rendering ([`src/renderer.ts`](src/renderer.ts)), **hit testing** ([`src/hittest.ts`](src/hittest.ts)), optional **Pretext** text ([`src/pretext-layout.ts`](src/pretext-layout.ts)), a small **kit** ([`src/kit/`](src/kit/)), and an optional **CPU ripple** module ([`src/fx/`](src/fx/)). Docs live in [`docs/`](docs/), especially [`docs/LLM_PRIMER.md`](docs/LLM_PRIMER.md), [`docs/SCENE_FORMAT.md`](docs/SCENE_FORMAT.md), [`docs/HYBRID_UI.md`](docs/HYBRID_UI.md), and [`docs/VISION_AND_LIMITS.md`](docs/VISION_AND_LIMITS.md).

**Goal of this handoff:** You assess **where the gaps are**, **what research is worth doing**, and **concrete steps to make Axiom a more usable library** for authors, LLMs, and downstream apps—not a full rewrite spec unless justified.

## What to deliver

1. **Gap analysis** — Product, API, DX, docs, testing, publishing, accessibility, and “Tier B/C” simulation (per `VISION_AND_LIMITS`). Be specific; cite files/paths where helpful.
2. **Research agenda** — Ranked list of **questions or literature** that would de-risk big bets (e.g. WebGL water vs CPU ripple, WASM physics, comparison with Rive/Lottie/CSS Houdini, LLM reliability on scene JSON).
3. **Usability roadmap** — Short-, medium-, and long-term actions: npm ergonomics (`prepare` script for git installs, subpath exports), example apps, templates, error messages, versioning policy, contributor onboarding, optional devtools or scene inspector.

## Constraints and honesty

- **Springs** are **UI dynamics**, not Navier–Stokes. The [`fx`](src/fx/) module is a **CPU wave grid**, not a fluid engine. Do not recommend marketing that blurs these boundaries without also recommending doc/API clarity.
- The project intentionally allows **hybrid DOM + canvas**; full-screen canvas is weak on **a11y/SEO/forms** unless addressed ([`docs/HYBRID_UI.md`](docs/HYBRID_UI.md)).

## Suggested investigation order

1. Read [`README.md`](../README.md), [`CHANGELOG.md`](../CHANGELOG.md), and [`package.json`](../package.json) (exports, `files`, scripts).
2. Skim core [`src/types.ts`](src/types.ts), [`src/runtime.ts`](src/runtime.ts), and one demo under [`src/demos/`](src/demos/).
3. Note test coverage ([`src/pretext-layout.test.ts`](src/pretext-layout.test.ts) only today) and build story (`build:lib` → `dist-lib/`).
4. Compare stated vision vs implementation (Pretext, kit, fx, prompts in [`docs/PROMPT_*.md`](docs/)).

## Output format

- Use clear headings: **Gaps**, **Research**, **Making the library more usable**.
- End with **5–10 prioritized next steps** (actionable, ordered).
- If you need repository access, ask for the GitHub URL or a zip; do not invent APIs that are not in the tree.

---

_End of paste block._
