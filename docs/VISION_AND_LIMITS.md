# Vision, limits, and depth tiers

Axiom is built to make **canvas UI** that is **explicit, spring-driven, and LLM-authorable**. This page aligns **what the library is** with **what it is not**, and maps **three depth tiers** for teams deciding how far to go toward simulation or high-end rendering.

---

## What Axiom is

- **Scene graph** as data (`Scene`, node types in [SCENE_FORMAT.md](SCENE_FORMAT.md)).
- **Spring dynamics** ([PHYSICS.md](PHYSICS.md)) for **interaction motion**: hover, press, settle, interruptible transitions.
- **Canvas 2D** rendering and hit testing without CSS layout.
- **Pretext** ([pretext-layout](https://www.npmjs.com/package/@chenglou/pretext)) for quality text wrapping when you opt in.
- Optional **`fx`** module: **CPU wave ripple** heightfield and small scheduling helpers—not a full fluid engine.

---

## What Axiom is not

- **Not** Navier–Stokes, **not** a rigid-body engine, **not** soft-body cloth out of the box.
- **Not** a replacement for **semantic HTML**, **forms**, or **screen-reader-first** apps without extra work ([HYBRID_UI.md](HYBRID_UI.md)).

**Springs simulate damped masses toward targets.** They do **not** simulate water, smoke, or cloth unless you **map** those phenomena onto spring targets (often a poor fit) or use **other** code paths.

---

## Depth tiers

### Tier A — Springs + canvas (core)

Best for: panels, timelines, editorial motion, most “math UI” demos.

Use `Runtime`, `render`, `physics` springs, Pretext, kit. **No** ripple module required.

### Tier B — Lightweight FX (`axiom/fx`)

Best for: **flat “pool” ripples**, metronome-style drops, cheap ambient motion **without** shaders.

- **`RippleSurface2D`**: 2D grid wave equation (CPU), `impulse()`, `step()`, `drawInto()`.
- **`DropMetronome`**: fixed-interval callbacks (e.g. one “drop” tick for visuals or game logic).

**Cost:** Grid resolution × steps per frame. Keep grids modest (e.g. 64×48) for 60fps on low-end devices.

### Tier C — High fidelity (outside core)

Best for: **3D water**, refraction, large particle counts, or **accurate** fluids.

- **WebGL / WebGPU** shaders (custom or Three.js / Babylon / OGL).
- **WASM** physics (e.g. Rapier) for games or complex interaction.

**Recommended pattern:** **Hybrid** — Axiom (or DOM) for **HUD / chrome**, WebGL for the **simulation view** in the same page. See [HYBRID_UI.md](HYBRID_UI.md).

---

## Closing the “physics” wording gap

If marketing says “physics-first UI,” clarify in docs:

- **UI physics** = springs + explicit geometry.
- **World simulation** = ripple FX, shaders, or external engines—not the same subsystem as `Spring` in [physics.ts](../src/physics.ts).

---

## Related

- [HYBRID_UI.md](HYBRID_UI.md) — canvas vs DOM, transparency pitfalls.
- [LLM_PRIMER.md](LLM_PRIMER.md) — draw order, scene contract.
- [PROMPT_WATER_CLOCK.md](PROMPT_WATER_CLOCK.md) — example prompt for Tier B ripple + HUD.
