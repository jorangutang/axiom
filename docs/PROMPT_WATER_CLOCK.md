# Example prompt: water surface + HUD (Tier B `fx`)

Use this when you want an LLM to build a **pool / ripple** metaphor **without** claiming that **springs** (`physics.ts`) simulate water.

**Read first:** [VISION_AND_LIMITS.md](VISION_AND_LIMITS.md), [LLM_PRIMER.md](LLM_PRIMER.md) (draw order), [HYBRID_UI.md](HYBRID_UI.md).

---

## Prompt (copy from here)

You are adding or adjusting a **water-clock** style demo in the Axiom repo.

### Rules

1. **Do not** animate bulk water with `runtime.spring()` on dozens of nodes. Use **`RippleSurface2D`** from **`axiom/fx`** (`step()`, `impulse()`, `drawInto()`) for the surface.
2. **Draw the ripple under UI** using **`Runtime.setRenderHooks({ afterBackground })`** so the scene’s **background / gradient** renders first, then **ripples**, then **nodes** (HUD).
3. **Springs** are for **panels, buttons, indicators** only — interaction physics, not fluid.
4. **Optional:** `DropMetronome` for periodic “drops” (visual impulses + copy). Timer **countdown** can stay real-time `remainingMs`; drops are **metaphor**, not physics time.
5. **Tier C** (WebGL water, refraction) is **out of scope** for this prompt — mention [VISION_AND_LIMITS.md](VISION_AND_LIMITS.md) if the user asks for 3D realism.

### Reference implementation

See [`src/demos/water-clock-demo.ts`](../src/demos/water-clock-demo.ts) and run with **`?demo=water`**.

### Deliverable

One demo file + `main.ts` query switch, or extend the existing water demo with clear comments separating **wave grid** vs **springs**.

---

## Why this exists

The Rain Timer-style prompt encouraged **sine-driven particles** and **springs on chrome**; that is honest but **not** a shared **ripple primitive**. Tier B **`fx`** gives a **single, documented path** for “flat pool + ripple” inside the library story.
